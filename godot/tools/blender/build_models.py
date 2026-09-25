"""Gera os modelos 3D do jogo no Blender, só com código (como a arte do jogo web).

Uso (Blender 5.2, portátil):
  E:/Tools/Blender/blender-5.2.2-windows-x64/blender.exe -b --factory-startup \
      -P godot/tools/blender/build_models.py -- [--preview] [nome ...]

Sai em godot/assets/<pasta>/<nome>.glb (personagens, armas e máquinas) e, com --preview,
um PNG de conferência de cada modelo em godot/tests/output/models/.

Convenções:
- metros; pés no chão (z = 0); o modelo olha para +Y no Blender, que vira -Z no Godot
  (a frente dos nós do jogo);
- personagens: malha única com grupos de vértices presos 100% a um osso (partes rígidas,
  estilo low-poly) e ações: Idle, Walk, Run, Attack, Death (+ Crawl, Roar, Slam, Charge);
- materiais com nomes de papel (Shirt, Skin, Pants, Eyes, Jacket, Pack, Hair, Fur, Metal,
  Glow...), que o Godot troca por cor (tipo de zumbi, visual do jogador, cor do perk);
- texturas pixeladas de 64×64 geradas aqui mesmo (tecido, tecido sujo, pele, pele de zumbi,
  pelo, metal, madeira, couro, cabelo), em tons quase neutros: a cor vem do material
  (textura × cor), então a troca de cor no Godot continua valendo.
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "assets")
PREVIEWS = os.path.join(ROOT, "tests", "output", "models")
FPS = 24


# ───────────────────────── Cena e materiais ─────────────────────────

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    _textures.clear()


_materials = {}
## Estilo do modelo em construção: "zombie" (roupa rasgada e suja, pele podre) ou "human".
_style = {"value": "human"}

## Textura de cada papel de material (por estilo). Sem entrada = sem textura (olhos, brilho).
TEXTURE_BY_ROLE = {
    "Shirt": ("cloth_dirty", "cloth"), "Pants": ("cloth_dirty", "cloth"), "Skin": ("skin_zombie", "skin"),
    "Shoes": ("leather", "leather"), "Jacket": ("cloth", "cloth"), "Pack": ("canvas", "canvas"),
    "Hair": ("hair", "hair"), "Belt": ("leather", "leather"), "Cap": ("cloth", "cloth"),
    "Uniform": ("cloth_dirty", "cloth"), "Gown": ("cloth_dirty", "cloth_dirty"), "Bandage": ("cloth_dirty", "cloth_dirty"),
    "Tumor": ("skin_zombie", "skin_zombie"), "Fur": ("fur", "fur"), "Metal": ("metal", "metal"),
    "Grip": ("wood", "wood"), "Wood": ("wood", "wood"), "Trim": ("metal", "metal"), "Body": ("paint", "paint"),
    "Bench": ("wood", "wood"), "Pouch": ("canvas", "canvas"), "Teeth": ("bone", "bone"), "Bone": ("bone", "bone"),
}


def material(name, color, roughness=0.85, metallic=0.0, emission=None, strength=2.0):
    """Material Principled com nome de papel (o Godot usa o nome para trocar a cor).
    Com textura: cor base = textura × cor (o exportador glTF guarda a cor como fator)."""
    key = (name, tuple(color), emission is not None)
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        if hasattr(mat, "use_nodes"):
            try:
                mat.use_nodes = True
            except Exception:
                pass
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    # As cores do script são sRGB (como no jogo web); o Blender e o glTF usam cor linear.
    color = tuple(_linear(c) for c in color[:3])
    if emission is not None:
        emission = tuple(_linear(c) for c in emission[:3])
    rgba = (color[0], color[1], color[2], 1.0)
    mat.diffuse_color = rgba
    kinds = TEXTURE_BY_ROLE.get(name)
    if bsdf and kinds and emission is None:
        kind = kinds[0] if _style["value"] == "zombie" else kinds[1]
        nt = mat.node_tree
        node = nt.nodes.get("Tex") or nt.nodes.new("ShaderNodeTexImage")
        node.name = "Tex"
        node.image = texture(kind)
        node.interpolation = "Closest"
        mix = nt.nodes.get("Tint") or nt.nodes.new("ShaderNodeMix")
        mix.name = "Tint"
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = rgba
        nt.links.new(node.outputs["Color"], mix.inputs[6])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    elif bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission is not None:
            bsdf.inputs["Emission Color"].default_value = (emission[0], emission[1], emission[2], 1.0)
            bsdf.inputs["Emission Strength"].default_value = strength
    _materials[key] = mat
    return mat


# ───────────────────────── Texturas ─────────────────────────

TEX = 64
_textures = {}


def _noise(rng, cells):
    """Ruído de valor que repete nas bordas (a textura emenda sem costura)."""
    grid = [[rng.random() for _ in range(cells)] for _ in range(cells)]

    def sample(x, y):
        fx = x / TEX * cells
        fy = y / TEX * cells
        x0, y0 = int(fx) % cells, int(fy) % cells
        x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
        tx, ty = fx - int(fx), fy - int(fy)
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        top = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx
        bottom = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx
        return top * (1 - ty) + bottom * ty
    return sample


def texture(kind):
    """Textura pixelada 64×64 (tons quase neutros; a cor vem do material)."""
    if kind in _textures:
        return _textures[kind]
    rng = random.Random(sum(ord(c) * 31 ** i for i, c in enumerate(kind)) & 0xFFFFFFFF)
    fine = _noise(rng, 16)
    coarse = _noise(rng, 4)
    px = [[0.9, 0.9, 0.9] for _ in range(TEX * TEX)]

    def at(x, y):
        return px[(y % TEX) * TEX + (x % TEX)]

    def shade(x, y, f):
        c = at(x, y)
        c[0], c[1], c[2] = c[0] * f[0], c[1] * f[1], c[2] * f[2]

    def blob(cx, cy, r, f):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r * (0.6 + 0.4 * rng.random()):
                    shade(cx + dx, cy + dy, f)

    for y in range(TEX):
        for x in range(TEX):
            n, c = fine(x, y), coarse(x, y)
            v = 0.9
            if kind in ("cloth", "cloth_dirty", "canvas"):
                v = 0.84 + 0.1 * n + 0.05 * c - (0.05 if (x + y) % 4 == 0 else 0) - (0.04 if (x - y) % 4 == 0 and kind == "canvas" else 0)
            elif kind in ("skin", "skin_zombie", "bone"):
                v = 0.9 + 0.07 * n + 0.04 * c if kind != "skin_zombie" else 0.8 + 0.14 * n + 0.08 * c
            elif kind in ("fur", "hair"):
                v = 0.72 + 0.25 * fine(x * 0.25, y * 2.0) + 0.05 * c
            elif kind in ("metal", "paint"):
                v = 0.8 + 0.1 * fine(x * 0.2, y) + 0.08 * c
            elif kind == "wood":
                v = 0.72 + 0.18 * (0.5 + 0.5 * math.sin(y * 0.55 + n * 6.0 + c * 3.0))
                if y % 16 == 0:
                    v *= 0.6
            elif kind == "leather":
                v = 0.8 + 0.12 * n + 0.06 * c
            px[y * TEX + x] = [v, v, v]
    # Detalhes de cada tipo.
    if kind in ("cloth", "cloth_dirty", "canvas"):
        for y in (0, TEX - 1):
            for x in range(0, TEX, 2):
                shade(x, y, (0.7, 0.7, 0.7))  # costura
    if kind == "cloth_dirty":
        for _ in range(14):
            blob(rng.randrange(TEX), rng.randrange(TEX), rng.randrange(2, 6), (0.72, 0.7, 0.66))  # sujeira
        for _ in range(6):
            blob(rng.randrange(TEX), rng.randrange(TEX), rng.randrange(2, 5), (0.72, 0.42, 0.4))  # sangue
        for _ in range(5):  # rasgos
            x, y = rng.randrange(TEX), rng.randrange(TEX)
            for i in range(rng.randrange(4, 10)):
                shade(x, y, (0.3, 0.3, 0.3))
                x += rng.choice((-1, 0, 1))
                y += 1
    if kind == "skin_zombie":
        for _ in range(8):  # veias
            x, y = rng.randrange(TEX), rng.randrange(TEX)
            for i in range(rng.randrange(6, 16)):
                shade(x, y, (0.78, 0.8, 0.86))
                x += rng.choice((-1, 0, 1))
                y += rng.choice((0, 1))
        for _ in range(5):
            blob(rng.randrange(TEX), rng.randrange(TEX), rng.randrange(2, 5), (0.75, 0.45, 0.45))  # feridas
    if kind == "canvas":
        for x in range(TEX):
            for y in (20, 21, 44, 45):
                shade(x, y, (0.75, 0.75, 0.75))  # tiras
    if kind in ("metal", "paint"):
        for _ in range(12):  # arranhões
            x, y = rng.randrange(TEX), rng.randrange(TEX)
            for i in range(rng.randrange(4, 12)):
                c = at(x, y)
                c[0] = c[1] = c[2] = min(1.0, c[0] * 1.2)
                x += 1
                y += rng.choice((0, 0, 1))
        for cx in (4, TEX - 5):
            for cy in (4, TEX - 5):
                shade(cx, cy, (0.55, 0.55, 0.55))  # rebites
    if kind == "paint":
        for _ in range(6):
            blob(rng.randrange(TEX), rng.randrange(TEX), rng.randrange(1, 4), (0.62, 0.55, 0.5))  # tinta descascada
    if kind == "leather":
        for _ in range(10):
            x, y = rng.randrange(TEX), rng.randrange(TEX)
            for i in range(rng.randrange(3, 8)):
                shade(x, y, (0.8, 0.8, 0.8))
                x += 1
    image = bpy.data.images.new("tex_" + kind, TEX, TEX)
    flat = []
    for y in range(TEX):
        for x in range(TEX):
            c = px[y * TEX + x]
            flat += [min(1.0, c[0]), min(1.0, c[1]), min(1.0, c[2]), 1.0]
    image.pixels = flat
    image.pack()
    _textures[kind] = image
    return image


def _linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcolor(value):
    return ((value >> 16 & 255) / 255.0, (value >> 8 & 255) / 255.0, (value & 255) / 255.0)


# ───────────────────────── Construtor de malha ─────────────────────────

class Builder:
    """Junta peças simples numa malha só, com material e osso (grupo de vértices) por peça."""

    def __init__(self):
        self.bm = bmesh.new()
        self.bm.loops.layers.uv.verify()
        self.mats = []
        self.groups = {}

    def _mat_index(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _finish(self, geom_verts, mat, group, matrix):
        bmesh.ops.transform(self.bm, matrix=matrix, verts=geom_verts)
        index = self._mat_index(mat)
        faces = set()
        for v in geom_verts:
            faces.update(v.link_faces)
        for f in faces:
            f.material_index = index
            f.smooth = False
        if group:
            self.groups.setdefault(group, []).extend(geom_verts)

    def box(self, size, loc, mat, group=None, rot=(0, 0, 0)):
        result = bmesh.ops.create_cube(self.bm, size=1.0, calc_uvs=True)
        matrix = Matrix.Translation(loc) @ _euler(rot) @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        self._finish(result["verts"], mat, group, matrix)

    def cylinder(self, radius, depth, loc, mat, group=None, rot=(0, 0, 0), segments=8, radius2=None):
        result = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments, calc_uvs=True,
                                       radius1=radius, radius2=radius if radius2 is None else radius2, depth=depth)
        matrix = Matrix.Translation(loc) @ _euler(rot)
        self._finish(result["verts"], mat, group, matrix)

    def sphere(self, radius, loc, mat, group=None, scale=(1, 1, 1), segments=8, rings=6):
        result = bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=rings, radius=radius, calc_uvs=True)
        matrix = Matrix.Translation(loc) @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        self._finish(result["verts"], mat, group, matrix)

    def build(self, name):
        mesh = bpy.data.meshes.new(name)
        self.bm.verts.index_update()
        groups = {g: [v.index for v in verts] for g, verts in self.groups.items()}
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.mats:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        for group, indices in groups.items():
            vg = obj.vertex_groups.new(name=group)
            vg.add(indices, 1.0, "REPLACE")
        return obj


def _euler(rot):
    return (Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X"))


# ───────────────────────── Esqueleto e animação ─────────────────────────

def armature(name, bones):
    """bones: lista de (nome, cabeça, cauda, pai)."""
    data = bpy.data.armatures.new(name + "_rig")
    obj = bpy.data.objects.new(name + "_rig", data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone_name, head, tail, parent in bones:
        eb = data.edit_bones.new(bone_name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        eb.roll = 0.0
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in obj.pose.bones:
        pb.rotation_mode = "XYZ"
    return obj


def bind(mesh_obj, rig):
    mesh_obj.parent = rig
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def _probe(rig, bone, rotation):
    """Ponta do osso (espaço do esqueleto) em repouso e girada, sem a ação atual interferir."""
    saved = rig.animation_data.action if rig.animation_data else None
    if saved:
        rig.animation_data.action = None
    # O esqueleto todo em repouso (um pai girado mudaria a direção medida).
    for other in rig.pose.bones:
        other.rotation_euler = (0, 0, 0)
        other.location = (0, 0, 0)
    pb = rig.pose.bones[bone]
    bpy.context.view_layer.update()
    rest = pb.tail.copy() - pb.head.copy()
    pb.rotation_euler = rotation
    bpy.context.view_layer.update()
    moved = pb.tail.copy() - pb.head.copy()
    pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    if saved:
        rig.animation_data.action = saved
    return rest, moved


def forward_sign(rig, bone):
    """+1 se girar o osso em +X leva a ponta para a frente (+Y), -1 se para trás."""
    rest, moved = _probe(rig, bone, (0.6, 0, 0))
    return 1.0 if moved.y > rest.y else -1.0


def up_sign(rig, bone):
    """+1 se girar o osso em +X levanta a ponta (+Z), -1 se abaixa."""
    rest, moved = _probe(rig, bone, (0.6, 0, 0))
    return 1.0 if moved.z > rest.z else -1.0


def side_sign(rig, bone):
    """+1 se girar o osso em +Z afasta a ponta do centro do corpo (abre o braço), -1 se fecha."""
    rest, moved = _probe(rig, bone, (0, 0, 0.6))
    head_x = rig.pose.bones[bone].head.x
    return 1.0 if abs(head_x + moved.x) > abs(head_x + rest.x) else -1.0


def action(rig, name, keys, length):
    """keys: {frame: {osso: (rx, ry, rz) ou ("loc", (x, y, z), (rx, ry, rz))}}."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    for pb in rig.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    # Todo osso tem chave em todo quadro-chave (o que não foi dito fica em repouso): assim
    # uma ação não herda a pose da anterior no Godot.
    for frame in sorted(keys):
        pose = keys[frame]
        for pb in rig.pose.bones:
            value = pose.get(pb.name, (0, 0, 0))
            if isinstance(value, tuple) and len(value) == 3 and value[0] == "loc":
                pb.location = value[1]
                pb.rotation_euler = value[2]
            else:
                pb.location = (0, 0, 0)
                pb.rotation_euler = value
            pb.keyframe_insert("location", frame=frame)
            pb.keyframe_insert("rotation_euler", frame=frame)
    act.frame_range = (0, length)
    return act


# ───────────────────────── Humanoide ─────────────────────────

HUMAN_BONES = [
    ("hips", (0, 0, 0.92), (0, 0, 1.05), None),
    ("spine", (0, 0, 1.05), (0, 0, 1.48), "hips"),
    ("head", (0, 0, 1.48), (0, 0, 1.8), "spine"),
    ("arm.L", (0.29, 0, 1.44), (0.29, 0, 0.84), "spine"),
    ("arm.R", (-0.29, 0, 1.44), (-0.29, 0, 0.84), "spine"),
    ("leg.L", (0.12, 0, 0.92), (0.12, 0, 0.06), "hips"),
    ("leg.R", (-0.12, 0, 0.92), (-0.12, 0, 0.06), "hips"),
]


def humanoid(name, torso, sleeve, skin, pants, shoes, eyes, extra=None, bulk=1.0):
    """Corpo em peças rígidas. `bulk` engorda o tronco (Paciente Zero)."""
    b = Builder()
    w = 0.5 * bulk
    b.box((w, 0.28 * bulk, 0.5), (0, 0, 1.24), torso, "spine")
    b.box((0.44 * bulk, 0.26 * bulk, 0.2), (0, 0, 0.98), pants, "hips")
    b.box((0.26, 0.26, 0.28), (0, 0.01, 1.64), skin, "head")
    b.box((0.2, 0.05, 0.08), (0, 0.14, 1.56), skin, "head")  # queixo
    b.box((0.05, 0.02, 0.04), (0.06, 0.135, 1.68), eyes, "head")
    b.box((0.05, 0.02, 0.04), (-0.06, 0.135, 1.68), eyes, "head")
    b.box((0.04, 0.05, 0.05), (0, 0.15, 1.62), skin, "head")  # nariz
    b.box((0.03, 0.07, 0.08), (0.14, 0.0, 1.64), skin, "head")  # orelhas
    b.box((0.03, 0.07, 0.08), (-0.14, 0.0, 1.64), skin, "head")
    b.box((0.13, 0.13, 0.08), (0, 0.0, 1.5), skin, "spine")  # pescoço
    b.box((0.3 * bulk, 0.3 * bulk, 0.05), (0, 0.0, 1.47), torso, "spine")  # gola
    for side, bone in ((1, "arm.L"), (-1, "arm.R")):
        x = side * (0.29 + (w - 0.5) * 0.5)
        b.box((0.13, 0.13, 0.32), (x, 0, 1.3), sleeve, bone)
        b.box((0.11, 0.11, 0.3), (x, 0, 1.0), skin, bone)
        b.box((0.1, 0.12, 0.09), (x, 0.01, 0.82), skin, bone)  # mão
        b.box((0.17, 0.19, 0.44), (side * 0.12, 0, 0.7), pants, "leg.L" if side > 0 else "leg.R")
        b.box((0.15, 0.17, 0.36), (side * 0.12, 0, 0.3), pants, "leg.L" if side > 0 else "leg.R")
        b.box((0.16, 0.26, 0.1), (side * 0.12, 0.04, 0.05), shoes, "leg.L" if side > 0 else "leg.R")
    if extra:
        extra(b)
    mesh = b.build(name)
    rig = armature(name, HUMAN_BONES)
    bind(mesh, rig)
    return rig


def human_actions(rig, zombie=True, runner=False):
    """Ações do humanoide. Zumbi: braços para a frente; jogador: arma na mão."""
    fa = forward_sign(rig, "arm.L")
    fl = forward_sign(rig, "leg.L")
    fs = forward_sign(rig, "spine")
    sl = side_sign(rig, "arm.L")
    sr = side_sign(rig, "arm.R")
    reach = 1.35 * fa  # braços esticados para a frente

    def arms(l, r, spread=0.0):
        """spread > 0 abre os dois braços para os lados."""
        return {"arm.L": (l, 0, spread * sl), "arm.R": (r, 0, spread * sr)}

    if zombie:
        idle = {
            0: {**arms(reach * 0.9, reach * 0.85), "spine": (0.12 * fs, 0, 0.05), "head": (0.1 * fs, 0.1, 0)},
            24: {**arms(reach * 0.8, reach * 0.95), "spine": (0.16 * fs, 0, -0.05), "head": (0.05 * fs, -0.1, 0)},
            48: {**arms(reach * 0.9, reach * 0.85), "spine": (0.12 * fs, 0, 0.05), "head": (0.1 * fs, 0.1, 0)},
        }
        action(rig, "Idle", idle, 48)
        swing = 0.45
        walk = {}
        for frame, phase in ((0, 1), (12, -1), (24, 1)):
            walk[frame] = {
                **arms(reach + 0.12 * phase, reach - 0.12 * phase),
                "leg.L": (swing * phase * fl, 0, 0), "leg.R": (-swing * phase * fl, 0, 0),
                "spine": (0.18 * fs, 0, 0.12 * phase), "head": (0.12 * fs, 0.15 * phase, 0),
                "hips": ("loc", (0, 0, 0), (0, 0, -0.08 * phase)),
            }
        action(rig, "Walk", walk, 24)
        run = {}
        for frame, phase in ((0, 1), (8, -1), (16, 1)):
            run[frame] = {
                **arms(reach * 0.7 + 0.35 * phase, reach * 0.7 - 0.35 * phase),
                "leg.L": (0.8 * phase * fl, 0, 0), "leg.R": (-0.8 * phase * fl, 0, 0),
                "spine": (0.35 * fs, 0, 0.08 * phase), "head": (-0.1 * fs, 0, 0),
            }
        action(rig, "Run", run, 16)
        attack = {
            0: {**arms(reach, reach), "spine": (0.15 * fs, 0, 0)},
            6: {**arms(reach * 1.5, reach * 1.5, 0.3), "spine": (-0.1 * fs, 0, 0)},
            11: {**arms(reach * 0.6, reach * 0.6, -0.1), "spine": (0.45 * fs, 0, 0)},
            18: {**arms(reach, reach), "spine": (0.15 * fs, 0, 0)},
        }
        action(rig, "Attack", attack, 18)
        crawl = {}
        for frame, phase in ((0, 1), (16, -1), (32, 1)):
            crawl[frame] = {
                "hips": ("loc", (0, 0, -0.62), (1.35 * fs, 0, 0)),
                "spine": (0.05 * fs, 0, 0.1 * phase), "head": (-0.9 * fs, 0, 0),
                **arms(1.9 * fa + 0.45 * phase, 1.9 * fa - 0.45 * phase),
                "leg.L": (-0.2 * fl + 0.15 * phase, 0, 0), "leg.R": (-0.2 * fl - 0.15 * phase, 0, 0),
            }
        action(rig, "Crawl", crawl, 32)
    else:
        # Braço direito (arm.L, lado +X) segura a arma na altura da mão do jogo (Hand); o outro apoia.
        aim = {"arm.L": (1.15 * fa, 0, -0.08 * sl), "arm.R": (1.0 * fa, 0, -0.5 * sr)}
        idle = {
            0: {**aim, "spine": (0.02 * fs, 0, 0)},
            30: {**aim, "spine": (0.05 * fs, 0, 0), "head": (0.04 * fs, 0, 0)},
            60: {**aim, "spine": (0.02 * fs, 0, 0)},
        }
        action(rig, "Idle", idle, 60)
        run = {}
        for frame, phase in ((0, 1), (9, -1), (18, 1)):
            run[frame] = {
                **aim, "leg.L": (0.7 * phase * fl, 0, 0), "leg.R": (-0.7 * phase * fl, 0, 0),
                "spine": (0.12 * fs, 0.05 * phase, 0),
                "hips": ("loc", (0, 0, 0.03 * abs(phase)), (0, 0, 0.1 * phase)),
            }
        action(rig, "Run", run, 18)
        action(rig, "Walk", run, 18)
    # Morte: cai de costas.
    death = {
        0: {"hips": ("loc", (0, 0, 0), (0, 0, 0))},
        8: {"hips": ("loc", (0, 0, -0.35), (-0.6 * fs, 0, 0.1)), "arm.L": (-0.5 * fa, 0, 0.6 * sl), "arm.R": (-0.3 * fa, 0, 0.5 * sr),
            "leg.L": (0.4 * fl, 0, 0), "head": (-0.3 * fs, 0, 0)},
        18: {"hips": ("loc", (0, 0, -0.8), (-1.5 * fs, 0, 0.15)), "arm.L": (-0.2 * fa, 0, 1.2 * sl), "arm.R": (-0.1 * fa, 0, 1.1 * sr),
             "leg.L": (0.25 * fl, 0, 0.1), "leg.R": (-0.1 * fl, 0, -0.1), "head": (-0.2 * fs, 0.4, 0)},
    }
    action(rig, "Death", death, 18)


def boss_actions(rig):
    """Ações extras dos bosses: Roar (braços abertos), Slam (murro no chão), Charge (investida)."""
    fa = forward_sign(rig, "arm.L")
    fs = forward_sign(rig, "spine")
    fl = forward_sign(rig, "leg.L")
    sl = side_sign(rig, "arm.L")
    sr = side_sign(rig, "arm.R")
    action(rig, "Roar", {
        0: {"arm.L": (0.3 * fa, 0, 0), "arm.R": (0.3 * fa, 0, 0)},
        10: {"arm.L": (0.4 * fa, 0, 1.2 * sl), "arm.R": (0.4 * fa, 0, 1.2 * sr), "spine": (-0.3 * fs, 0, 0), "head": (-0.5 * fs, 0, 0)},
        40: {"arm.L": (0.5 * fa, 0, 1.25 * sl), "arm.R": (0.5 * fa, 0, 1.25 * sr), "spine": (-0.35 * fs, 0, 0), "head": (-0.55 * fs, 0, 0)},
        52: {"arm.L": (0.3 * fa, 0, 0), "arm.R": (0.3 * fa, 0, 0)},
    }, 52)
    action(rig, "Slam", {
        0: {"arm.L": (0.3 * fa, 0, 0), "arm.R": (0.3 * fa, 0, 0)},
        12: {"arm.L": (2.9 * fa, 0, 0.2 * sl), "arm.R": (2.9 * fa, 0, 0.2 * sr), "spine": (-0.25 * fs, 0, 0)},
        18: {"arm.L": (1.1 * fa, 0, 0.1 * sl), "arm.R": (1.1 * fa, 0, 0.1 * sr), "spine": (0.6 * fs, 0, 0),
             "hips": ("loc", (0, 0, -0.15), (0, 0, 0))},
        30: {"arm.L": (0.3 * fa, 0, 0), "arm.R": (0.3 * fa, 0, 0)},
    }, 30)
    charge = {}
    for frame, phase in ((0, 1), (6, -1), (12, 1)):
        charge[frame] = {"spine": (0.55 * fs, 0, 0), "head": (-0.35 * fs, 0, 0),
                         "arm.L": (-0.6 * fa, 0, 0.3 * sl), "arm.R": (-0.6 * fa, 0, 0.3 * sr),
                         "leg.L": (0.9 * phase * fl, 0, 0), "leg.R": (-0.9 * phase * fl, 0, 0)}
    action(rig, "Charge", charge, 12)


# ───────────────────────── Quadrúpede (cão) ─────────────────────────

HOUND_BONES = [
    ("body", (0, -0.35, 0.62), (0, 0.35, 0.62), None),
    ("head", (0, 0.35, 0.68), (0, 0.7, 0.72), "body"),
    ("tail", (0, -0.38, 0.66), (0, -0.75, 0.8), "body"),
    ("leg.FL", (0.13, 0.28, 0.55), (0.13, 0.28, 0.04), "body"),
    ("leg.FR", (-0.13, 0.28, 0.55), (-0.13, 0.28, 0.04), "body"),
    ("leg.BL", (0.13, -0.28, 0.55), (0.13, -0.28, 0.04), "body"),
    ("leg.BR", (-0.13, -0.28, 0.55), (-0.13, -0.28, 0.04), "body"),
]


def hound():
    fur = material("Fur", hexcolor(0x3a2a22), 0.95)
    dark = material("Skin", hexcolor(0x5c2a22), 0.9)
    eyes = material("Eyes", (1.0, 0.45, 0.1), 0.5, emission=(1.0, 0.45, 0.1), strength=6.0)
    b = Builder()
    b.box((0.34, 0.8, 0.32), (0, 0, 0.62), fur, "body")
    b.box((0.3, 0.2, 0.3), (0, 0.3, 0.66), fur, "body")  # peito
    b.box((0.22, 0.3, 0.22), (0, 0.5, 0.74), fur, "head")
    b.box((0.14, 0.2, 0.12), (0, 0.7, 0.68), dark, "head")  # focinho
    b.box((0.05, 0.08, 0.12), (0.08, 0.44, 0.9), fur, "head", rot=(0.3, 0, 0.2))
    b.box((0.05, 0.08, 0.12), (-0.08, 0.44, 0.9), fur, "head", rot=(0.3, 0, -0.2))
    b.box((0.04, 0.02, 0.03), (0.06, 0.645, 0.78), eyes, "head")
    b.box((0.04, 0.02, 0.03), (-0.06, 0.645, 0.78), eyes, "head")
    b.box((0.05, 0.4, 0.05), (0, -0.55, 0.73), fur, "tail", rot=(0.4, 0, 0))
    bone = material("Bone", hexcolor(0xcfc6b0), 0.7)
    for i in range(5):
        b.box((0.05, 0.06, 0.1), (0, -0.3 + i * 0.14, 0.8), dark, "body", rot=(-0.4, 0, 0))  # espinhos
    b.box((0.12, 0.03, 0.03), (0, 0.8, 0.64), bone, "head")  # dentes
    for i in range(3):
        b.box((0.02, 0.14, 0.02), (0.171, -0.05 + i * 0.1, 0.6), bone, "body")  # costelas
    for name, x, y in (("leg.FL", 0.13, 0.28), ("leg.FR", -0.13, 0.28), ("leg.BL", 0.13, -0.28), ("leg.BR", -0.13, -0.28)):
        b.box((0.08, 0.1, 0.5), (x, y, 0.3), fur, name)
        b.box((0.09, 0.13, 0.05), (x, y + 0.02, 0.03), dark, name)
    mesh = b.build("Hound")
    rig = armature("Hound", HOUND_BONES)
    bind(mesh, rig)
    f = forward_sign(rig, "leg.FL")
    action(rig, "Idle", {
        0: {"head": (0, 0, 0.1), "tail": (0, 0, 0.3)},
        20: {"head": (0.1, 0, -0.1), "tail": (0, 0, -0.3)},
        40: {"head": (0, 0, 0.1), "tail": (0, 0, 0.3)},
    }, 40)
    run = {}
    for frame, phase in ((0, 1), (6, -1), (12, 1)):
        run[frame] = {"leg.FL": (0.8 * phase * f, 0, 0), "leg.FR": (0.6 * phase * f, 0, 0),
                      "leg.BL": (-0.8 * phase * f, 0, 0), "leg.BR": (-0.6 * phase * f, 0, 0),
                      "body": ("loc", (0, 0, 0.04 * phase), (0.08 * phase, 0, 0)), "tail": (0.3 * phase, 0, 0)}
    action(rig, "Run", run, 12)
    action(rig, "Walk", run, 12)
    action(rig, "Attack", {
        0: {"head": (0, 0, 0)},
        5: {"head": (-0.4, 0, 0), "body": ("loc", (0, 0.1, 0), (-0.15, 0, 0))},
        9: {"head": (0.35, 0, 0), "body": ("loc", (0, 0.25, 0), (0.1, 0, 0))},
        16: {"head": (0, 0, 0), "body": ("loc", (0, 0, 0), (0, 0, 0))},
    }, 16)
    action(rig, "Death", {
        0: {"body": ("loc", (0, 0, 0), (0, 0, 0))},
        12: {"body": ("loc", (0, 0, -0.38), (0, 1.4, 0)), "leg.FL": (0.5 * f, 0, 0), "leg.BL": (-0.5 * f, 0, 0), "head": (0.3, 0, 0)},
    }, 12)
    return rig


# ───────────────────────── Personagens ─────────────────────────

def zombie():
    bone = material("Bone", hexcolor(0xcfc6b0), 0.7)

    def rot(b):
        shirt = material("Shirt", hexcolor(0x5e5343))
        b.box((0.16, 0.03, 0.14), (0.14, 0.14, 0.93), shirt, "spine", rot=(0.3, 0, 0.25))  # aba rasgada
        b.box((0.12, 0.03, 0.1), (-0.16, -0.14, 0.95), shirt, "spine", rot=(-0.3, 0, -0.2))
        for i in range(3):
            b.box((0.1, 0.02, 0.02), (-0.14, 0.142, 1.15 + i * 0.06), bone, "spine")  # costelas
        b.box((0.12, 0.02, 0.025), (0, 0.141, 1.575), bone, "head")  # dentes

    rig = humanoid(
        "Zombie",
        torso=material("Shirt", hexcolor(0x5e5343)),
        sleeve=material("Shirt", hexcolor(0x5e5343)),
        skin=material("Skin", hexcolor(0x6c765f), 0.9),
        pants=material("Pants", hexcolor(0x35393a)),
        shoes=material("Shoes", hexcolor(0x1d1b19)),
        eyes=material("Eyes", (1.0, 0.25, 0.15), 0.5, emission=(1.0, 0.25, 0.15), strength=4.0),
        extra=rot,
    )
    human_actions(rig, zombie=True)
    return rig


def survivor():
    jacket = material("Jacket", hexcolor(0x4b5140))
    pack = material("Pack", hexcolor(0x5d4731))
    hair = material("Hair", hexcolor(0x35271b))

    def gear(b):
        b.box((0.4, 0.18, 0.46), (0, -0.22, 1.2), pack, "spine")
        b.box((0.28, 0.28, 0.08), (0, -0.01, 1.8), hair, "head")
        b.box((0.28, 0.08, 0.16), (0, -0.13, 1.72), hair, "head")
        belt = material("Belt", hexcolor(0x2a241c))
        pouch = material("Pouch", hexcolor(0x4a4a38))
        b.box((0.52, 0.3, 0.07), (0, 0, 1.02), belt, "hips")
        for x in (-0.14, 0.14):
            b.box((0.05, 0.3, 0.5), (x, 0.0, 1.24), belt, "spine")  # alças da mochila
        b.box((0.1, 0.07, 0.1), (0.2, 0.16, 1.0), pouch, "hips")  # bolsos
        b.box((0.1, 0.07, 0.1), (-0.2, 0.16, 1.0), pouch, "hips")
        b.box((0.08, 0.08, 0.12), (0.2, -0.12, 0.98), pouch, "hips")  # coldre
        b.box((0.17, 0.05, 0.1), (0.12, 0.1, 0.55), pouch, "leg.L")  # joelheiras
        b.box((0.17, 0.05, 0.1), (-0.12, 0.1, 0.55), pouch, "leg.R")
        b.cylinder(0.035, 0.12, (0.2, 0.12, 1.42), material("Metal", hexcolor(0x2b2d31), 0.4, 0.7), "spine", rot=(math.pi / 2, 0, 0))  # lanterna
        b.box((0.12, 0.05, 0.12), (0.12, -0.33, 1.3), pouch, "spine")  # bolso da mochila

    rig = humanoid(
        "Survivor",
        torso=jacket, sleeve=jacket,
        skin=material("Skin", hexcolor(0xc79a7a), 0.8),
        pants=material("Pants", hexcolor(0x2f3440)),
        shoes=material("Shoes", hexcolor(0x231d18)),
        eyes=material("Eyes", hexcolor(0x1a1a1a), 0.5),
        extra=gear,
    )
    human_actions(rig, zombie=False)
    return rig


def conductor():
    cap = material("Cap", hexcolor(0x1c2438))

    def uniform(b):
        b.box((0.3, 0.3, 0.1), (0, 0.01, 1.82), cap, "head")
        b.box((0.3, 0.16, 0.03), (0, 0.18, 1.78), cap, "head")  # aba
        b.box((0.58, 0.32, 0.5), (0, 0, 0.9), material("Uniform", hexcolor(0x2c3a5a)), "hips")  # casaco comprido
        badge = material("Badge", (0.85, 0.7, 0.25), 0.3, 0.8)
        b.box((0.06, 0.02, 0.06), (0.12, 0.155, 1.34), badge, "spine")
        for i in range(4):
            b.box((0.03, 0.02, 0.03), (0, 0.152, 1.08 + i * 0.1), badge, "spine")  # botões
        b.box((0.14, 0.03, 0.03), (0, 0.145, 1.585), material("Hair", hexcolor(0x5a5a58)), "head")  # bigode
        metal = material("Metal", hexcolor(0x2b2d31), 0.4, 0.7)
        b.box((0.12, 0.12, 0.03), (-0.29, 0.02, 0.73), metal, "arm.R")  # lampião
        b.box((0.1, 0.1, 0.14), (-0.29, 0.02, 0.64), material("Glow", (1.0, 0.7, 0.3), 0.3, emission=(1.0, 0.7, 0.3), strength=4.0), "arm.R")
        b.box((0.12, 0.12, 0.03), (-0.29, 0.02, 0.56), metal, "arm.R")

    rig = humanoid(
        "Conductor",
        torso=material("Uniform", hexcolor(0x2c3a5a)), sleeve=material("Uniform", hexcolor(0x2c3a5a)),
        skin=material("Skin", hexcolor(0x7d8a6a), 0.9), pants=material("Pants", hexcolor(0x1e2230)),
        shoes=material("Shoes", hexcolor(0x111111)),
        eyes=material("Eyes", (1.0, 0.8, 0.3), 0.5, emission=(1.0, 0.8, 0.3), strength=5.0),
        extra=uniform,
    )
    human_actions(rig, zombie=True)
    boss_actions(rig)
    return rig


def patient_zero():
    def gown(b):
        b.box((0.66, 0.4, 0.62), (0, 0, 0.95), material("Gown", hexcolor(0x9bb0a8)), "hips")  # avental
        b.box((0.3, 0.3, 0.06), (0, 0.0, 1.47), material("Bandage", hexcolor(0xd8d2c0)), "head")
        b.box((0.08, 0.3, 0.08), (0.36, 0.02, 1.06), material("Bandage", hexcolor(0xd8d2c0)), "arm.L")
        tumor = material("Tumor", hexcolor(0x8a4b52), 0.7)
        b.sphere(0.14, (0.16, 0.12, 1.32), tumor, "spine", scale=(1.0, 0.8, 1.0))
        b.sphere(0.09, (-0.2, -0.14, 1.4), tumor, "spine")
        b.sphere(0.07, (0.1, 0.1, 1.72), tumor, "head")
        b.box((0.13, 0.13, 0.04), (-0.36, 0.0, 0.92), material("Bandage", hexcolor(0xd8d2c0)), "arm.R")  # pulseira
        b.cylinder(0.012, 0.6, (0.3, -0.12, 1.15), material("Glow", (0.7, 1.0, 0.2), 0.3, emission=(0.7, 1.0, 0.2), strength=2.0), "spine", rot=(0.3, 0, 0))  # tubo

    rig = humanoid(
        "PatientZero",
        torso=material("Gown", hexcolor(0x9bb0a8)), sleeve=material("Skin", hexcolor(0x8f9a7c), 0.9),
        skin=material("Skin", hexcolor(0x8f9a7c), 0.9), pants=material("Gown", hexcolor(0x9bb0a8)),
        shoes=material("Skin", hexcolor(0x8f9a7c), 0.9),
        eyes=material("Eyes", (0.7, 1.0, 0.2), 0.5, emission=(0.7, 1.0, 0.2), strength=5.0),
        extra=gown, bulk=1.25,
    )
    human_actions(rig, zombie=True)
    boss_actions(rig)
    return rig


# ───────────────────────── Armas (por tipo) ─────────────────────────

def weapon(kind):
    """Arma apontando para +Y; o cabo na origem (a mão). Materiais: Metal, Grip, Glow."""
    metal = material("Metal", hexcolor(0x2b2d31), 0.4, 0.7)
    grip = material("Grip", hexcolor(0x4a3524), 0.8)
    glow_colors = {"arc": (0.45, 0.8, 1.0), "energy": (0.5, 1.0, 0.45), "wind": (0.75, 0.95, 1.0), "flamer": (1.0, 0.5, 0.15)}
    glow = material("Glow", glow_colors.get(kind, (1.0, 0.8, 0.4)), 0.3,
                    emission=glow_colors.get(kind, (1.0, 0.8, 0.4)), strength=3.0)
    b = Builder()

    def body(length, height=0.1, width=0.06, y0=-0.05):
        b.box((width, length, height), (0, y0 + length * 0.5, 0.06), metal)

    def barrel(length, radius=0.018, y0=0.1, z=0.08):
        b.cylinder(radius, length, (0, y0 + length * 0.5, z), metal, rot=(math.pi / 2, 0, 0))

    def handle(y=0.0):
        b.box((0.05, 0.07, 0.14), (0, y, -0.04), grip, rot=(-0.25, 0, 0))

    def stock(length=0.24):
        b.box((0.05, length, 0.1), (0, -0.05 - length * 0.5, 0.04), grip)

    def mag(y, h=0.14, curve=0.0):
        b.box((0.04, 0.06, h), (0, y, -0.03 - h * 0.3), metal, rot=(curve, 0, 0))

    if kind in ("pistol", "akimbo", "revolver"):
        for x in ((-0.1, 0.1) if kind == "akimbo" else (0.0,)):
            b.box((0.05, 0.2, 0.07), (x, 0.06, 0.07), metal)
            b.box((0.045, 0.06, 0.13), (x, -0.01, -0.02), grip, rot=(-0.3, 0, 0))
            if kind == "revolver":
                b.cylinder(0.035, 0.07, (x, 0.05, 0.06), metal, rot=(math.pi / 2, 0, 0), segments=6)
                b.cylinder(0.012, 0.16, (x, 0.2, 0.08), metal, rot=(math.pi / 2, 0, 0))
    elif kind == "smg":
        body(0.34)
        handle()
        mag(0.1, 0.18)
        barrel(0.12, y0=0.28)
    elif kind in ("rifle", "ak", "sniper"):
        length = 0.62 if kind != "sniper" else 0.72
        body(length * 0.6, 0.1)
        stock()
        handle(0.02)
        mag(0.16, 0.2, 0.35 if kind == "ak" else 0.0)
        barrel(length * 0.55, y0=length * 0.5)
        if kind == "ak":
            b.box((0.055, 0.2, 0.05), (0, 0.38, 0.02), grip)
        if kind == "sniper":
            b.cylinder(0.03, 0.26, (0, 0.2, 0.16), metal, rot=(math.pi / 2, 0, 0))
    elif kind in ("shotgun", "lmg"):
        body(0.5, 0.11, 0.07)
        stock()
        handle(0.02)
        barrel(0.4, 0.022, y0=0.42)
        if kind == "shotgun":
            b.box((0.05, 0.18, 0.05), (0, 0.4, 0.01), grip)
        else:
            b.box((0.12, 0.14, 0.12), (0.06, 0.16, -0.02), metal)  # caixa de munição
            b.cylinder(0.03, 0.3, (0, 0.62, 0.08), metal, rot=(math.pi / 2, 0, 0), segments=6)
    elif kind == "launcher":
        b.cylinder(0.06, 0.62, (0, 0.2, 0.09), metal, rot=(math.pi / 2, 0, 0), segments=10)
        handle(0.02)
        b.box((0.05, 0.08, 0.1), (0, 0.18, 0.0), grip)
    elif kind == "flamer":
        body(0.5, 0.09)
        handle(0.02)
        b.cylinder(0.05, 0.28, (0, 0.12, -0.08), glow, rot=(math.pi / 2, 0, 0))  # tanque
        barrel(0.2, 0.025, y0=0.44)
    elif kind in ("arc", "energy"):
        body(0.44, 0.12, 0.08)
        handle(0.02)
        for i in range(3):
            b.cylinder(0.045 - i * 0.006, 0.035, (0, 0.2 + i * 0.08, 0.07), glow, rot=(math.pi / 2, 0, 0), segments=10)
        barrel(0.14, 0.02, y0=0.42)
    elif kind == "wind":
        body(0.36, 0.1)
        handle(0.02)
        b.cylinder(0.11, 0.16, (0, 0.4, 0.08), metal, rot=(math.pi / 2, 0, 0), segments=12, radius2=0.07)
        for i in range(4):
            b.box((0.015, 0.02, 0.17), (0, 0.46, 0.08), glow, rot=(0, i * math.pi / 4, 0))
    else:
        body(0.3)
        handle()
    if kind not in ("pistol", "akimbo", "revolver", "launcher"):
        b.box((0.02, 0.04, 0.03), (0, 0.02, 0.13), metal)  # mira traseira
        b.box((0.03, 0.02, 0.012), (0, 0.02, -0.08), metal)  # guarda-mato
    b.box((0.01, 0.01, 0.01), (0, 0.0, 0.0), metal)  # garante o material Metal
    obj = b.build("Gun_" + kind)
    return obj


WEAPON_KINDS = ["pistol", "smg", "rifle", "ak", "shotgun", "launcher", "flamer", "arc", "energy",
                "revolver", "sniper", "akimbo", "lmg", "wind"]


# ───────────────────────── Máquinas ─────────────────────────

def mystery_box():
    wood = material("Wood", hexcolor(0x6b4a24), 0.8)
    gold = material("Trim", (0.95, 0.72, 0.25), 0.35, 0.8)
    glow = material("Glow", (1.0, 0.82, 0.48), 0.3, emission=(1.0, 0.82, 0.48), strength=2.0)
    b = Builder()
    b.box((2.0, 1.1, 0.8), (0, 0, 0.4), wood, "base")
    b.box((2.06, 1.16, 0.08), (0, 0, 0.8), gold, "base")
    b.box((0.08, 1.16, 0.8), (0.98, 0, 0.4), gold, "base")
    b.box((0.08, 1.16, 0.8), (-0.98, 0, 0.4), gold, "base")
    b.box((0.2, 0.02, 0.3), (0, 0.56, 0.45), glow, "base")  # "?"
    b.box((0.2, 0.02, 0.3), (0, -0.56, 0.45), glow, "base")
    for x in (-1.03, 1.03):
        b.box((0.04, 0.3, 0.06), (x, 0, 0.55), gold, "base")  # alças
    b.box((2.0, 1.1, 0.14), (0, 0, 0.07), wood, "lid")
    b.box((2.06, 1.16, 0.04), (0, 0, 0.02), gold, "lid")
    mesh = b.build("MysteryBox")
    rig = armature("MysteryBox", [("base", (0, 0, 0), (0, 0, 0.4), None), ("lid", (0, -0.55, 0.84), (0, 0.55, 0.84), "base")])
    # A tampa é montada em z=0..0.14 e sobe até o topo pelo osso (posição de repouso).
    for v in mesh.data.vertices:
        if any(g.group == mesh.vertex_groups["lid"].index for g in v.groups):
            v.co.z += 0.84
    bind(mesh, rig)
    action(rig, "Closed", {0: {"lid": (0, 0, 0)}, 1: {"lid": (0, 0, 0)}}, 1)
    up = up_sign(rig, "lid")
    action(rig, "Open", {0: {"lid": (0, 0, 0)}, 10: {"lid": (1.2 * up, 0, 0)}, 20: {"lid": (1.1 * up, 0, 0)}}, 20)
    return rig


def perk_machine():
    body = material("Body", hexcolor(0x8a2a24), 0.6, 0.2)
    glass = material("Glow", (1.0, 0.9, 0.6), 0.2, emission=(1.0, 0.9, 0.6), strength=2.5)
    metal = material("Metal", hexcolor(0x2b2d31), 0.4, 0.7)
    b = Builder()
    b.box((1.0, 0.7, 2.1), (0, 0, 1.05), body)
    b.box((0.7, 0.04, 0.9), (0, 0.35, 1.35), glass)
    b.box((0.8, 0.04, 0.18), (0, 0.36, 1.95), glass)
    b.box((0.5, 0.05, 0.2), (0, 0.36, 0.5), metal)
    b.box((1.04, 0.74, 0.08), (0, 0, 0.04), metal)
    return b.build("PerkMachine")


def weapon_lab():
    metal = material("Metal", hexcolor(0x3a3d42), 0.5, 0.6)
    top = material("Bench", hexcolor(0x55504a), 0.8)
    glow = material("Glow", (0.45, 0.85, 1.0), 0.3, emission=(0.45, 0.85, 1.0), strength=3.0)
    b = Builder()
    b.box((1.8, 0.8, 0.08), (0, 0, 0.95), top)
    for x in (-0.8, 0.8):
        for y in (-0.33, 0.33):
            b.box((0.08, 0.08, 0.92), (x, y, 0.46), metal)
    b.box((0.5, 0.4, 0.5), (-0.5, 0, 1.24), metal)  # prensa
    b.cylinder(0.08, 0.3, (-0.5, 0, 1.6), metal)
    b.box((0.36, 0.05, 0.26), (0.45, -0.3, 1.2), glow, rot=(-0.3, 0, 0))  # tela
    b.box((0.7, 0.3, 0.04), (0.3, 0.1, 1.0), metal)
    return b.build("WeaponLab")


# ───────────────────────── Exportação e prévia ─────────────────────────

def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False,
                              export_animations=True, export_animation_mode="ACTIONS", export_yup=True,
                              export_apply=False)
    print("  ", os.path.relpath(path, ROOT))


def preview(path, distance=4.0, height=1.0, pose_action=None, frame=0):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.render.resolution_x = 480
    scene.render.resolution_y = 480
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("Preview") if scene.world is None else scene.world
    scene.world = world
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (distance * 0.75, distance, height + distance * 0.35)
    direction = Vector((0, 0, height * 0.8)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    if pose_action:
        for obj in scene.objects:
            if obj.type == "ARMATURE" and obj.animation_data:
                act = bpy.data.actions.get(pose_action)
                if act:
                    obj.animation_data.action = act
    scene.frame_set(frame)
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


# Personagens e armas agora são pixel art (npm run godot:sprites); aqui ficam só as máquinas.
MODELS = {
    "mystery_box": ("props", mystery_box, 3.5, 0.5, "Open"),
    "perk_machine": ("props", perk_machine, 4.0, 1.0, None),
    "weapon_lab": ("props", weapon_lab, 3.5, 0.9, None),
}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    want_preview = "--preview" in args
    names = [a for a in args if not a.startswith("--")] or list(MODELS)
    for name in names:
        folder, build, distance, height, pose = MODELS[name]
        reset_scene()
        _style["value"] = "zombie" if name in ("zombie", "hound", "boss_conductor", "boss_patient_zero") else "human"
        build()
        out = os.path.join(ASSETS, folder, name + ".glb")
        export(out)
        if want_preview:
            preview(os.path.join(PREVIEWS, name + ".png"), distance, height, pose, 12)


if __name__ == "__main__":
    main()
