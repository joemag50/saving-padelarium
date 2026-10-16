"""
Builds one friend from Quaternius' "Ultimate Modular Men" (CC0) and renders their sprite frames.

Run headless (Blender doesn't need to be open):
  Blender -b --disable-autoexec Humans_Master.blend -P art/blender/build_character.py -- \
      art/characters/jose.json <output dir> [--preview]

The character JSON picks the modular parts, recolors materials by name and adds extras (cap).
Every character goes through the same camera and light, so they all share size and style.
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
config = json.load(open(args[0]))
out_dir = args[1]
preview = '--preview' in args
os.makedirs(out_dir, exist_ok=True)

FRAME_PX = 256
# Reference height: a 180 cm friend fills this much of the frame. Shorter friends come out smaller.
REFERENCE_CM = 180
# Animations rendered into strips: name in game -> (Quaternius action, frames, loop).
ANIMATIONS = {
    'idle': ('Idle', 8, True),
    'walk': ('Walk', 8, True),
    'run': ('Run', 8, True),
    'attack': ('Punch_Right', 13, False),
    'hurt': ('HitRecieve', 4, False),
    'dodge': ('Roll', 8, False),
    'fall': ('Death', 8, False),
    # Proposed for the enemies in art/characters/ENEMIGOS.md (not rendered yet).
    'dash': ('Run', 8, True),
    'serve': ('Sword_Slash', 12, False),
    'charge': ('Run', 8, True),
    'raise': ('Wave', 8, False),
    'stunned': ('HitRecieve_2', 6, False),
    'exhausted': ('Idle_Neutral', 8, True),
}
# Animations that leave the square frame (lying on the floor) get a wider one, same center.
WIDE_FRAMES = {'fall': 384}
# House style: a bit wider and shorter than the pack's realistic proportions, with a bigger head,
# so friends read well at game size next to chunky enemies. A friend's JSON can override them.
PROPORTIONS = {'width': 1.15, 'height': 0.92, 'head': 1.2}
# Slightly turned toward the camera (90° = pure profile facing right).
FACING_DEG = 72
CAMERA_ELEVATION_DEG = 12

scene = bpy.context.scene
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
wanted = set(config['parts'].values())


def srgb_to_linear(hex_color):
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


# --- Keep only the chosen parts -------------------------------------------------------------
for obj in list(bpy.data.objects):
    if obj.type == 'MESH' and obj.name not in wanted:
        bpy.data.objects.remove(obj, do_unlink=True)
    elif obj.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(obj, do_unlink=True)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']


# Drop faces by material (e.g. the witch hat off a head with long hair): {"head": ["Purple"]}.
for part, names in config.get('deleteMaterials', {}).items():
    obj = bpy.data.objects[config['parts'][part]]
    slots = {i for i, s in enumerate(obj.material_slots) if s.material and s.material.name in names}
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in slots], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


# --- Cel-shaded materials -------------------------------------------------------------------
def toon_material(name, hex_color):
    """Two-tone shading (lit / shadow) as flat colors, like a cartoon."""
    mat = bpy.data.materials.new(f"{config['id']}_{name}")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    to_rgb = nodes.new('ShaderNodeShaderToRGB')
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.62, 0.62, 0.7, 1)
    ramp.color_ramp.elements[1].position = 0.18
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[7].default_value = srgb_to_linear(hex_color)
    emission = nodes.new('ShaderNodeEmission')
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(diffuse.outputs[0], to_rgb.inputs[0])
    links.new(to_rgb.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], mix.inputs[6])
    links.new(mix.outputs[2], emission.inputs['Color'])
    links.new(emission.outputs[0], output.inputs['Surface'])
    return mat


materials = {}
part_of = {name: part for part, name in config['parts'].items()}


def material_for(original_name, part=None):
    # "partColors" overrides a material on one piece only (e.g. white stripes on the shorts but
    # not on the shoes): {"legs": {"White": "#hex"}}.
    color = config.get('partColors', {}).get(part, {}).get(original_name) or config['colors'].get(original_name)
    key = (original_name, color)
    if key not in materials:
        if color is None:
            # Keep the pack's own color (eyes, etc.).
            src = bpy.data.materials[original_name]
            bsdf = next((n for n in src.node_tree.nodes if n.type in ('BSDF_PRINCIPLED', 'BSDF_DIFFUSE')), None)
            c = bsdf.inputs[0].default_value if bsdf else (0.5, 0.5, 0.5, 1)
            to_srgb = lambda v: v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
            color = '#%02x%02x%02x' % tuple(round(max(0, min(1, to_srgb(c[i]))) * 255) for i in range(3))
        materials[key] = toon_material(original_name, color)
        materials[key]['source'] = original_name
    return materials[key]


for obj in meshes:
    for slot in obj.material_slots:
        if slot.material:
            slot.material = material_for(slot.material.name, part_of.get(obj.name))


# --- Extras: cap ----------------------------------------------------------------------------
def world_bbox(objs):
    deps = bpy.context.evaluated_depsgraph_get()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        ev = o.evaluated_get(deps)
        for v in ev.to_mesh().vertices:
            p = ev.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
        ev.to_mesh_clear()
    return lo, hi


def ride_head(obj, bone='Head'):
    """Parent to a bone (the head by default), keeping its place, so it follows every animation."""
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world


def add_object(name, mesh, color):
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(toon_material(name, color))
    return obj


def ellipsoid(name, color, radius, scale, location, segments=(16, 10)):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments[0], v_segments=segments[1], radius=radius)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    bm.to_mesh(mesh)
    bm.free()
    obj = add_object(name, mesh, color)
    obj.location = location
    return obj


def torus(name, color, major, minor, location, rotation, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=20,
                                     minor_segments=6, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(toon_material(name, color))
    return obj


def cylinder(name, color, radius, depth, location, rotation, scale=(1, 1, 1), vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(toon_material(name, color))
    return obj


armature.data.pose_position = 'REST'
bpy.context.view_layer.update()
head_obj = bpy.data.objects[config['parts']['head']]
head_lo, head_hi = world_bbox([head_obj])
body_lo, body_hi = world_bbox(meshes)

if 'cap' in config:
    cap_cfg = config['cap']
    width = head_hi.x - head_lo.x
    center = (head_lo + head_hi) / 2
    radius = width * 0.6
    mesh = bpy.data.meshes.new('cap')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=radius)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -radius * 0.05], context='VERTS')
    # A cap's crown is lower than a full half-sphere.
    for v in bm.verts:
        v.co.z *= 0.72
    # Brim: a flat half-disc sticking out; the face looks toward -Y, so "backwards" is +Y.
    direction = 1 if cap_cfg.get('backwards') else -1
    brim = bmesh.ops.create_circle(bm, cap_ends=True, segments=16, radius=radius * 0.95)
    for v in brim['verts']:
        # Oval disc pushed out one side; the half inside the crown stays hidden.
        v.co.y = v.co.y * 0.9 + direction * radius * 0.7
        v.co.z = radius * 0.02
    bm.to_mesh(mesh)
    bm.free()
    cap = bpy.data.objects.new('cap', mesh)
    scene.collection.objects.link(cap)
    cap.data.materials.append(toon_material('cap', cap_cfg['color']))
    cap.location = (center.x, center.y + width * 0.04, head_hi.z - radius * 0.84)
    cap.rotation_euler = (math.radians(-8 * direction), 0, 0)
    solid = cap.modifiers.new('thick', 'SOLIDIFY')
    solid.thickness = radius * 0.06
    ride_head(cap)
    meshes.append(cap)

# Alien costume head: a big rubber mask worn over a real head. Every kind has its own style:
# default (almond eyes + antennae), cyclops (one giant eye), crest (helmet ridge), gasmask
# (round goggles + filter), helmet (racing helmet with a glowing visor and a fin) and emperor
# (crown of spikes). Hats and headphones in "alienMask" ride on it and fly off with it.
mask_parts = []
if 'alienMask' in config:
    mask_cfg = config['alienMask']
    style = mask_cfg.get('style', 'default')
    color = mask_cfg['color']
    eye_color = mask_cfg.get('eyeColor', '#0b0b12')
    glow = mask_cfg.get('glowColor', '#f0abfc')
    width = head_hi.x - head_lo.x
    center = (head_lo + head_hi) / 2
    r = width * mask_cfg.get('size', 0.78)
    mask_mesh = bpy.data.meshes.new('mask')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=r)
    for v in bm.verts:
        if style in ('helmet', 'cyclops'):
            # Round: a racing helmet, or an inflatable ball of a head.
            v.co.z *= 1.05
            continue
        # Tall dome on top, narrowing into a small chin (the classic "grey" head).
        v.co.z *= 1.25 if v.co.z > 0 else 1.05
        if v.co.z < 0:
            taper = 1 + (v.co.z / r) * 0.62
            v.co.x *= taper
            v.co.y *= taper
    bm.to_mesh(mask_mesh)
    bm.free()
    mask = add_object('mask', mask_mesh, color)
    mask.location = (center.x, center.y, center.z + r * 0.12)
    mask_parts.append(mask)
    mz = center.z + r * 0.12  # the mask's own center
    dome_top = mz + r * (1.05 if style in ('helmet', 'cyclops') else 1.25)

    def mask_part(obj):
        mask_parts.append(obj)
        return obj

    if style in ('default', 'crest', 'emperor'):
        for side in (-1, 1):
            # Big almonds sitting on the surface, wrapping around toward the sides.
            eye = mask_part(ellipsoid('mask_eye', eye_color, r * 0.44, (1.0, 0.42, 0.62),
                                      (center.x + side * r * 0.46, center.y - r * 0.78, mz + r * 0.04)))
            eye.rotation_euler = (0, math.radians(-28 * side), math.radians(35 * side))
    if style == 'cyclops':
        mask_part(ellipsoid('mask_eye', '#f8fafc', r * 0.5, (1, 0.45, 1), (center.x, center.y - r * 0.82, mz + r * 0.15)))
        mask_part(ellipsoid('mask_pupil', eye_color, r * 0.26, (1, 0.4, 1), (center.x, center.y - r * 1.02, mz + r * 0.15)))
    if style == 'gasmask':
        for side in (-1, 1):
            goggle = mask_part(cylinder('goggle', eye_color, r * 0.3, r * 0.2,
                                        (center.x + side * r * 0.42, center.y - r * 0.82, mz + r * 0.1), (math.radians(90), 0, 0)))
            goggle.rotation_euler = (math.radians(90), 0, math.radians(-25 * side))
        mask_part(cylinder('filter', mask_cfg.get('filterColor', '#374151'), r * 0.32, r * 0.45,
                           (center.x, center.y - r * 0.95, mz - r * 0.55), (math.radians(80), 0, 0)))
        mask_part(cylinder('filter_cap', glow, r * 0.22, r * 0.08,
                           (center.x, center.y - r * 1.2, mz - r * 0.6), (math.radians(80), 0, 0)))
    if style == 'helmet':
        # Glowing visor wrapping the front, and a fin along the top.
        visor = mask_part(ellipsoid('visor', mask_cfg.get('visorColor', '#a5f3fc'), r * 0.9, (0.95, 0.5, 0.42),
                                    (center.x, center.y - r * 0.6, mz + r * 0.05)))
        mask_part(ellipsoid('fin', mask_cfg.get('finColor', glow), r * 0.7, (0.12, 1.0, 0.45),
                            (center.x, center.y + r * 0.15, mz + r * 0.95)))
    if style == 'crest':
        mask_part(ellipsoid('crest', mask_cfg.get('crestColor', glow), r * 0.8, (0.16, 1.1, 0.5),
                            (center.x, center.y + r * 0.1, dome_top - r * 0.15)))
    if style == 'emperor':
        # A crown of spikes around the dome.
        for k in range(7):
            t = math.radians(-90 + 360 * k / 7)
            cx, cy = center.x + math.cos(t) * r * 0.62, center.y + math.sin(t) * r * 0.62
            spike = mask_part(cylinder('crown', mask_cfg.get('crownColor', '#fde047'), r * 0.14, r * 0.7,
                                       (cx, cy, dome_top - r * 0.35), (0, 0, 0), vertices=6))
            spike.rotation_euler = (-math.sin(t) * 0.35, math.cos(t) * 0.35, 0)
            spike.scale = (1, 1, 1)
            mask_part(ellipsoid('crown_gem', glow, r * 0.11, (1, 1, 1),
                                (cx + math.cos(t) * r * 0.12, cy + math.sin(t) * r * 0.12, dome_top), (8, 6)))
    if mask_cfg.get('antennae', style in ('default', 'gasmask')):
        for side in (-1, 1):
            stalk = mask_part(ellipsoid('antenna', color, r * 0.06, (1, 1, 6),
                                        (center.x + side * r * 0.35, center.y + r * 0.1, dome_top + r * 0.18), (8, 6)))
            stalk.rotation_euler = (0, math.radians(18 * side), 0)
            mask_part(ellipsoid('antenna_tip', glow, r * 0.16, (1, 1, 1),
                                (center.x + side * r * 0.47, center.y + r * 0.1, dome_top + r * 0.58), (10, 8)))
    if 'headphones' in mask_cfg:
        hp = mask_cfg['headphones']
        for side in (-1, 1):
            mask_part(cylinder('ear_cup', hp['color'], r * 0.42, r * 0.32,
                               (center.x + side * r * 1.02, center.y, mz + r * 0.05), (0, math.radians(90), 0)))
            mask_part(cylinder('ear_glow', hp.get('accent', glow), r * 0.26, r * 0.06,
                               (center.x + side * r * 1.2, center.y, mz + r * 0.05), (0, math.radians(90), 0)))
        band = mask_part(torus('headband_hp', hp['color'], r * 1.08, r * 0.09, (center.x, center.y, mz + r * 0.2),
                               (0, math.radians(90), math.radians(90))))
        band.scale = (1, 1.12, 1)
    if 'hardHat' in mask_cfg:
        hh = mask_cfg['hardHat']
        mesh = bpy.data.meshes.new('hard_hat')
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=10, radius=r * 0.85)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -r * 0.02], context='VERTS')
        bm.to_mesh(mesh)
        bm.free()
        hat = mask_part(add_object('hard_hat', mesh, hh['color']))
        hat.location = (center.x, center.y, dome_top - r * 0.6)
        hat.scale = (1, 1.05, 0.8)
        mask_part(cylinder('hat_brim', hh['color'], r * 1.0, r * 0.08, (center.x, center.y - r * 0.12, dome_top - r * 0.6), (0, 0, 0)))
    for part in mask_parts:
        ride_head(part)
    meshes += mask_parts


# --- Paint zones: recolor part of a piece, e.g. a single sock or pants cut at mid-calf --------
# [{"part": "legs", "from": "Skin", "color": "#hex", "below": 0.2, "side": "R"}]; heights are a
# fraction of the model's height, "R"/"L" is the character's own right/left (right is -X).
model_height = body_hi.z - body_lo.z
for i, paint in enumerate(config.get('paint', [])):
    obj = bpy.data.objects[config['parts'][paint['part']]]
    mirror = next((m for m in obj.modifiers if m.type == 'MIRROR'), None)
    if paint.get('side') and mirror:
        # The pack models half of each piece and mirrors it; make the other half real to paint one side.
        armature.data.pose_position = 'REST'
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
            bpy.ops.object.modifier_apply(modifier=mirror.name)
    slots = {j for j, s in enumerate(obj.material_slots) if s.material and s.material.get('source') == paint['from']}
    obj.data.materials.append(toon_material(f'paint{i}', paint['color']))
    new_index = len(obj.data.materials) - 1
    lo = body_lo.z + model_height * paint.get('above', -1)
    hi = body_lo.z + model_height * paint.get('below', 2)
    for poly in obj.data.polygons:
        if poly.material_index not in slots:
            continue
        c = obj.matrix_world @ poly.center
        side = paint.get('side')
        if lo <= c.z <= hi and (side is None or (side == 'R') == (c.x < 0)):
            poly.material_index = new_index


# --- Accessories made by script (they ride the head or the forearms) -------------------------
def head_slice(z, band=0.012):
    """Extent of the head (hair included) around height z: center x/y and half sizes."""
    pts = [head_obj.matrix_world @ v.co for v in head_obj.data.vertices]
    near = [p for p in pts if abs(p.z - z) < band] or pts
    xs, ys = [p.x for p in near], [p.y for p in near]
    return Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, z)), (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2


def eye_level():
    eye_mat = config.get('eyeMaterial', 'Eye')
    slots = {i for i, s in enumerate(head_obj.material_slots) if s.material and s.material.get('source') == eye_mat}
    centers = [head_obj.matrix_world @ p.center for p in head_obj.data.polygons if p.material_index in slots]
    if centers:
        return sum((c.z for c in centers)) / len(centers), max(abs(c.x) for c in centers), min(c.y for c in centers)
    # No eye material (women's pack): eyes sit a bit under the middle of the head.
    return head_lo.z + (head_hi.z - head_lo.z) * 0.62, (head_hi.x - head_lo.x) * 0.18, None


extras = []  # (object, bone)
eye_z, eye_x, eye_y = eye_level()
face, face_a, face_b = head_slice(eye_z)
# The face's front at eye level (the hair's bangs can stick out further).
face_front = eye_y if eye_y is not None else face.y - face_b
top_z = head_hi.z
rad = math.radians

if 'glasses' in config:
    color = config['glasses']['color']
    lens = eye_x * 0.75
    for side in (-1, 1):
        extras.append((torus('lens', color, lens, lens * 0.16, (side * eye_x * 1.05, face_front - 0.01, eye_z),
                             (rad(90), 0, 0)), 'Head'))
        # Temple arm along the side of the head, back to the ear.
        extras.append((cylinder('temple', color, lens * 0.12, face_b * 1.2,
                                (side * face_a * 1.02, face.y - face_b * 0.35, eye_z), (rad(90), 0, 0)), 'Head'))
    extras.append((cylinder('bridge', color, lens * 0.12, eye_x * 0.5, (0, face_front - 0.01, eye_z + lens * 0.2),
                            (0, rad(90), 0)), 'Head'))

if 'headband' in config:
    z = eye_z + (top_z - eye_z) * config['headband'].get('height', 0.38)
    c, a, b = head_slice(z)
    extras.append((torus('headband', config['headband']['color'], 1, 0.06, (c.x, c.y, z), (rad(-6), 0, 0),
                         (a * 1.03, b * 1.03, a * 2)), 'Head'))

if 'mustache' in config:
    color = config['mustache']['color']
    for side in (-1, 1):
        m = ellipsoid('mustache', color, 1, (face_a * 0.3, face_a * 0.09, face_a * 0.1),
                      (side * face_a * 0.22, face_front + face_a * 0.08, eye_z - (eye_z - head_lo.z) * 0.32))
        m.rotation_euler = (0, rad(-22 * side), 0)
        extras.append((m, 'Head'))

if 'earrings' in config:
    color = config['earrings']['color']
    size = config['earrings'].get('size', 1)
    c, a, b = head_slice(eye_z - face_a * 0.25)
    for side in (-1, 1):
        extras.append((torus('earring', color, face_a * 0.17 * size, face_a * 0.035,
                             (c.x + side * a * 0.98, c.y + b * 0.1, eye_z - face_a * 0.62), (0, rad(90), 0)), 'Head'))

if 'dreads' in config:
    color = config['dreads']['color']
    count = config['dreads'].get('count', 11)
    length = config['dreads'].get('length', 0.2)
    z = eye_z + face_a * 0.25
    c, a, b = head_slice(z)
    for k in range(count):
        # Around the back and the sides, leaving the face clear.
        t = rad(-20 + 220 * k / (count - 1))
        x, y = c.x + math.cos(t) * a * 0.95, c.y + math.sin(t) * b * 0.95
        tilt = 0.25
        d = cylinder('dread', color, face_a * 0.1, length,
                     (x + math.cos(t) * length * tilt * 0.5, y + math.sin(t) * length * tilt * 0.5, z - length / 2),
                     (0, 0, 0))
        d.rotation_euler = (math.sin(t) * tilt, -math.cos(t) * tilt, 0)
        extras.append((d, 'Head'))

if 'curls' in config:
    color = config['curls']['color']
    z0 = eye_z + face_a * 0.25
    for k in range(60):
        # Golden spiral over the upper half of the head.
        t = k * 2.39996
        h = (k + 0.5) / 60
        z = z0 + (top_z - z0) * h ** 0.7
        c, a, b = head_slice(z, 0.02)
        ring = math.sqrt(max(0.05, 1 - h ** 1.6))
        p = (c.x + math.cos(t) * a * ring, c.y + math.sin(t) * b * ring, z)
        if p[1] < face_front + b * 0.35 and z < eye_z + (top_z - eye_z) * 0.45:
            continue  # keep the forehead clear
        extras.append((ellipsoid('curl', color, face_a * 0.28, (1, 1, 1), p, (8, 6)), 'Head'))

if 'hairFill' in config:
    # A solid shell under the pack's hair cards, so straight hair reads as one mass (no gaps
    # showing the background between strands). Open at the face.
    cfg = config['hairFill']
    bottom = eye_z - face_a * cfg.get('drop', 1.0)
    c, a, b = head_slice(eye_z + face_a * 0.2)
    rz = (top_z - bottom) / 2
    mesh = bpy.data.meshes.new('hair_fill')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1)
    for v in bm.verts:
        v.co.x *= a * 0.97
        v.co.y *= b * 0.97
        v.co.z *= rz * 0.98
    cz = bottom + rz
    face_cut = [v for v in bm.verts if v.co.y < -b * 0.25 and v.co.z + cz < eye_z + face_a * 0.45]
    bmesh.ops.delete(bm, geom=face_cut, context='VERTS')
    bm.to_mesh(mesh)
    bm.free()
    fill = add_object('hair_fill', mesh, cfg['color'])
    fill.location = (c.x, c.y + b * 0.04, cz)
    extras.append((fill, 'Head'))

if 'rastaHat' in config:
    # A big knitted tam slouching back, striped from the brim up (red, gold, green by default).
    stripes = config['rastaHat'].get('colors', ['#d42a2a', '#f2c94c', '#2e9e4f'])
    z = eye_z + (top_z - eye_z) * 0.35
    c, a, b = head_slice(z)
    r = max(a, b) * 1.3
    mesh = bpy.data.meshes.new('rasta_hat')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=r)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -r * 0.35], context='VERTS')
    for v in bm.verts:
        v.co.z *= 0.8
    bm.to_mesh(mesh)
    bm.free()
    hat = bpy.data.objects.new('rasta_hat', mesh)
    scene.collection.objects.link(hat)
    for k, color in enumerate(stripes):
        hat.data.materials.append(toon_material(f'rasta{k}', color))
    span = r * 0.8 * 1.35
    for poly in hat.data.polygons:
        h = (poly.center.z + r * 0.8 * 0.35) / span
        poly.material_index = min(len(stripes) - 1, int(h * len(stripes)))
    hat.location = (c.x, c.y + b * 0.35, z + r * 0.25)
    hat.rotation_euler = (rad(-14), 0, 0)
    extras.append((hat, 'Head'))

if 'longHair' in config:
    color = config['longHair']['color']
    length = config['longHair'].get('length', 0.28)
    c, a, b = head_slice(eye_z)
    hair = ellipsoid('long_hair', color, 1, (a * 1.02, b * 0.55, length / 2),
                     (c.x, c.y + b * 0.5, eye_z + face_a * 0.4 - length / 2))
    extras.append((hair, 'Head'))

for part, key in (('wristbands', 'wristbands'), ('bracelets', 'bracelets')):
    if key not in config:
        continue
    color = config[key]['color']
    for side, sign in (('L', 1), ('R', -1)):
        bone = armature.data.bones[f'LowerArm.{side}']
        wrist = armature.matrix_world @ bone.tail_local
        elbow = armature.matrix_world @ bone.head_local
        axis = (wrist - elbow).normalized()
        if key == 'wristbands':
            obj = cylinder('wristband', color, 0.042, 0.065, wrist - axis * 0.05, (0, rad(90), 0))
        else:
            obj = torus('bracelet', color, 0.036, 0.008, wrist - axis * 0.03, (0, rad(90), 0))
            obj2 = torus('bracelet', color, 0.038, 0.007, wrist - axis * 0.06, (0, rad(90), 0))
            extras.append((obj2, f'LowerArm.{side}'))
        extras.append((obj, f'LowerArm.{side}'))

if 'skirt' in config:
    cfg = config['skirt']
    mesh = bpy.data.meshes.new('skirt')
    bm = bmesh.new()
    top, bottom = cfg.get('top', 1.0), cfg.get('bottom', 0.7)
    bmesh.ops.create_cone(bm, cap_ends=False, segments=18, radius1=cfg.get('flare', 0.3),
                          radius2=cfg.get('waist', 0.19), depth=top - bottom)
    bm.to_mesh(mesh)
    bm.free()
    skirt = add_object('skirt', mesh, cfg['color'])
    skirt.location = (0, -0.05, (top + bottom) / 2)
    skirt.scale = (1, 0.8, 1)
    skirt.modifiers.new('thick', 'SOLIDIFY').thickness = 0.012
    extras.append((skirt, 'Hips'))

# --- Costume props: they stay on when the mask comes off --------------------------------------
def bone_point(name, end='tail'):
    bone = armature.data.bones[name]
    return armature.matrix_world @ (bone.tail_local if end == 'tail' else bone.head_local)


def box(name, color, size, location):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(toon_material(name, color))
    return obj


def body_slice(z, band=0.03):
    """Half width (the pack models one mirrored half) and front/back of the torso at height z."""
    body = bpy.data.objects[config['parts']['body']]
    pts = [body.matrix_world @ v.co for v in body.data.vertices]
    near = [p for p in pts if abs(p.z - z) < band and abs(p.x) < 0.3]
    return max(abs(p.x) for p in near), min(p.y for p in near), max(p.y for p in near)


def in_hand(side):
    """Center of the closed fist: just past the wrist, toward the fingers."""
    wrist = bone_point(f'Wrist.{side}')
    knuckles = bone_point(f'Middle1.{side}')
    return wrist + (knuckles - wrist) * 0.6 + Vector((0, 0, -0.01))


if 'racket' in config:
    cfg = config['racket']
    k = cfg.get('scale', 1)
    hand = in_hand(cfg.get('hand', 'R'))
    bone = f"Wrist.{cfg.get('hand', 'R')}"
    # Held like a sword: handle out of the fist toward the front (-Y). The face lies flat in the
    # rest pose (arms out), so it stands up facing the camera once the arm hangs down.
    extras.append((cylinder('racket_handle', cfg['color'], 0.02 * k, 0.15 * k, hand + Vector((0, -0.075 * k, 0)),
                            (rad(90), 0, 0)), bone))
    extras.append((ellipsoid('racket_face', cfg.get('faceColor', cfg['color']), 1, (0.13 * k, 0.15 * k, 0.025 * k),
                             hand + Vector((0, -0.29 * k, 0))), bone))
    extras.append((torus('racket_rim', cfg['color'], 1, 0.12, hand + Vector((0, -0.29 * k, 0)), (0, 0, 0),
                         (0.13 * k, 0.15 * k, 0.15 * k)), bone))

if 'giantPen' in config:
    cfg = config['giantPen']
    hand = in_hand('R')
    extras.append((cylinder('pen', cfg['color'], 0.03, 0.42, hand + Vector((0, -0.12, 0)), (rad(90), 0, 0)), 'Wrist.R'))
    tip = cylinder('pen_tip', cfg.get('tipColor', '#111827'), 0.03, 0.08, hand + Vector((0, -0.37, 0)), (rad(90), 0, 0),
                   vertices=8)
    tip.scale = (0.5, 0.5, 1)
    extras.append((tip, 'Wrist.R'))

if 'briefcase' in config:
    cfg = config['briefcase']
    side = cfg.get('hand', 'L')
    hand = in_hand(side)
    out = 1 if side == 'L' else -1
    # Hangs from the fist: along the arm's axis in the rest pose (down when the arm hangs).
    extras.append((box('briefcase', cfg['color'], (0.22, 0.34, 0.08), hand + Vector((out * 0.16, 0, 0))), f'Wrist.{side}'))
    extras.append((box('briefcase_clasp', cfg.get('claspColor', '#fbbf24'), (0.03, 0.08, 0.09),
                       hand + Vector((out * 0.05, 0, 0))), f'Wrist.{side}'))

if 'shield' in config:
    cfg = config['shield']
    # Carried in front, on the side the camera sees: a flying saucer with lights around the rim.
    chest = bone_point('Torso')
    half, front, _ = body_slice(chest.z)
    center = Vector((-half * 0.9, front - 0.12, chest.z - 0.05))
    normal_turn = rad(-55)  # facing between front (-Y) and the character's right (-X)
    disc = ellipsoid('shield', cfg['color'], 1, (0.24, 0.07, 0.24), center)
    disc.rotation_euler = (0, 0, normal_turn)
    dome = ellipsoid('shield_dome', cfg.get('domeColor', '#bfdbfe'), 1, (0.1, 0.09, 0.1),
                     center + Vector((math.sin(normal_turn) * 0.05, -math.cos(normal_turn) * 0.05, 0)))
    dome.rotation_euler = (0, 0, normal_turn)
    extras += [(disc, 'Chest'), (dome, 'Chest')]
    for k in range(8):
        t = rad(360 * k / 8)
        local = Vector((math.cos(t) * 0.2, -0.05, math.sin(t) * 0.2))
        local.rotate(disc.rotation_euler)
        extras.append((ellipsoid('shield_light', cfg.get('lightsColor', '#fde047'), 0.022, (1, 1, 1), center + local, (8, 6)),
                       'Chest'))

if 'cape' in config:
    cfg = config['cape']
    top = bone_point('Chest', 'head').z + 0.1
    bottom = top - (0.95 if cfg.get('long') else 0.55)
    _, _, back = body_slice(top - 0.08)
    mesh = bpy.data.meshes.new('cape')
    bm = bmesh.new()
    # A trapezoid that flares toward the hem, a bit away from the back.
    rows = 6
    verts = []
    for i in range(rows + 1):
        t = i / rows
        z = top + (bottom - top) * t
        w = 0.2 + 0.14 * t
        y = back + 0.03 + 0.1 * t
        verts.append([bm.verts.new((x * w, y, z)) for x in (-1, -0.5, 0, 0.5, 1)])
    for i in range(rows):
        for j in range(4):
            bm.faces.new((verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]))
    bm.to_mesh(mesh)
    bm.free()
    cape = add_object('cape', mesh, cfg['color'])
    cape.modifiers.new('thick', 'SOLIDIFY').thickness = 0.015
    extras.append((cape, 'Chest'))

if 'belly' in config:
    # Inflatable costume: a big round torso over the suit.
    z = bone_point('Torso', 'head').z
    half, front, back = body_slice(z)
    extras.append((ellipsoid('belly', config['belly']['color'], 1, (half * 1.25, (back - front) * 0.95, 0.3),
                             (0, (front + back) / 2 - 0.03, z + 0.02)), 'Torso'))

if 'shoulderPads' in config:
    for side, sign in (('L', 1), ('R', -1)):
        p = bone_point(f'UpperArm.{side}', 'head')
        pad = ellipsoid('shoulder_pad', config['shoulderPads']['color'], 1, (0.11, 0.1, 0.06), p + Vector((sign * 0.02, 0, 0.05)))
        extras.append((pad, f'UpperArm.{side}'))

if 'steamTank' in config:
    cfg = config['steamTank']
    z = bone_point('Torso', 'head').z + 0.1
    _, _, back = body_slice(z)
    for x in (-0.08, 0.08):
        extras.append((cylinder('tank', cfg['color'], 0.075, 0.36, (x, back + 0.08, z), (0, 0, 0)), 'Chest'))
        extras.append((ellipsoid('tank_top', cfg.get('capColor', '#10b981'), 0.075, (1, 1, 0.6), (x, back + 0.08, z + 0.18)),
                       'Chest'))
    extras.append((cylinder('tank_valve', cfg.get('capColor', '#10b981'), 0.02, 0.12, (0, back + 0.08, z + 0.24), (0, rad(90), 0)),
                   'Chest'))

if 'hazardStripes' in config:
    cfg = config['hazardStripes']
    for z in (bone_point('Torso', 'head').z + 0.02, bone_point('Torso', 'head').z + 0.14):
        half, front, back = body_slice(z)
        extras.append((torus('stripe', cfg['color'], 1, 0.12, (0, (front + back) / 2, z), (0, 0, 0),
                             (half * 1.04, (back - front) / 2 * 1.06, 0.16)), 'Torso'))

if 'tie' in config:
    cfg = config['tie']
    z = bone_point('Chest', 'head').z
    _, front, _ = body_slice(z - 0.1)
    extras.append((ellipsoid('tie', cfg['color'], 1, (0.04, 0.012, 0.16), (0, front - 0.012, z - 0.12)), 'Chest'))
    extras.append((ellipsoid('tie_knot', cfg['color'], 1, (0.03, 0.02, 0.025), (0, front - 0.015, z + 0.05)), 'Chest'))

for obj, bone in extras:
    ride_head(obj, bone)
    meshes.append(obj)

armature.data.pose_position = 'POSE'

# --- Outline (inverted hull): a black shell slightly bigger than the body -------------------
outline = bpy.data.materials.new('outline')
outline.use_nodes = True
outline.use_backface_culling = True
nodes = outline.node_tree.nodes
nodes.clear()
em = nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (0.02, 0.02, 0.03, 1)
out_node = nodes.new('ShaderNodeOutputMaterial')
outline.node_tree.links.new(em.outputs[0], out_node.inputs['Surface'])
for obj in meshes:
    obj.data.materials.append(outline)
    mod = obj.modifiers.new('outline', 'SOLIDIFY')
    mod.thickness = -0.012
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(obj.data.materials) - 1
    mod.offset = 1

# --- Size, facing, camera -------------------------------------------------------------------
height = body_hi.z - body_lo.z
scale = (config.get('heightCm', REFERENCE_CM) / REFERENCE_CM)
proportions = {**PROPORTIONS, **config.get('proportions', {})}
# Scaling the armature object (origin at the feet) keeps the feet on the floor.
armature.scale = (scale * proportions['width'], scale * proportions['width'], scale * proportions['height'])
armature.rotation_euler = (0, 0, math.radians(FACING_DEG))
reference_height = height  # model height maps to REFERENCE_CM

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
# The frame is a bit taller than the reference character so punches, rolls and falls fit.
# The very tall (the final boss) get a taller frame at the same size per pixel: the extra room
# goes above, so the feet stay in the same place.
frame_height = config.get('frameHeight', FRAME_PX)
base_scale = reference_height * 1.45
cam.data.ortho_scale = base_scale * frame_height / FRAME_PX
# The scale is the frame's height, so wider frames (falls) keep the same size per pixel.
cam.data.sensor_fit = 'VERTICAL'
elev = math.radians(CAMERA_ELEVATION_DEG)
dist = 10
# Feet sit near the bottom of the frame: aim the camera above them.
target = Vector((0, 0, reference_height * 0.62 + (cam.data.ortho_scale - base_scale) / 2))
cam.location = target + Vector((0, -math.cos(elev) * dist, math.sin(elev) * dist))
cam.rotation_euler = (math.radians(90) - elev, 0, 0)

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-30))
sun.data.energy = 3

engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
scene.view_settings.view_transform = 'Standard'
scene.render.film_transparent = True
scene.render.resolution_x = FRAME_PX
scene.render.resolution_y = frame_height
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
try:
    scene.eevee.taa_render_samples = 16
except AttributeError:
    pass


def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


armature.animation_data_create()
# Center the chest in the frame (the turn toward the camera shifts it), so the game can place
# hitboxes from the frame center for every friend.
armature.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(0)
chest = armature.matrix_world @ armature.pose.bones['Chest'].head
armature.location.x -= chest.x
bpy.context.view_layer.update()

def show(objs, visible):
    for o in objs:
        o.hide_render = not visible


only = next((a.split('=', 1)[1] for a in args if a.startswith('--only=')), None)
# Each character renders only the animations the game plays for them.
wanted_anims = config.get('animations', list(ANIMATIONS))
anims = {name: ANIMATIONS[name] for name in wanted_anims}
if preview:
    anims = {'idle': ANIMATIONS['idle']}
if only:
    anims = {only: ANIMATIONS[only]}
manifest = {}


def render_animation(name, suffix=''):
    action_name, count, loop = ANIMATIONS[name]
    width = {**WIDE_FRAMES, **config.get('wideFrames', {})}.get(name, FRAME_PX)
    scene.render.resolution_x = width
    action = bpy.data.actions[action_name]
    armature.animation_data.action = action
    start, end = action.frame_range
    # Looping animations skip the last frame (it repeats the first).
    span = end - start
    for i in range(count):
        t = start + span * (i / count if loop else i / max(1, count - 1))
        # The actions don't key the head's scale, so reset it or it would grow frame after frame.
        head_bone = armature.pose.bones['Head']
        head_bone.scale = (1, 1, 1)
        scene.frame_set(int(t), subframe=t - int(t))
        # Applied after the action is evaluated, so it holds on every frame (the cap rides along).
        head_bone.scale *= proportions['head']
        render(os.path.join(out_dir, f"{config['id']}-{name}{suffix}-{i:02d}.png"))
    manifest[name + suffix] = {'frames': count, 'loop': loop, 'width': width}


# In costume, the real head is hidden under the mask.
show([head_obj], not mask_parts)
for name in anims:
    render_animation(name)

if mask_parts and not preview:
    # Later levels: the mask flies off when they go down, showing a regular person.
    show(mask_parts, False)
    show([head_obj], True)
    for name in config.get('unmaskedAnimations', []):
        if not only or only == name:
            render_animation(name, '-unmasked')
    # The mask alone, as it looks on the standing pose, for the game to toss.
    show([o for o in meshes if o not in mask_parts], False)
    show(mask_parts, True)
    armature.animation_data.action = bpy.data.actions['Idle']
    armature.pose.bones['Head'].scale = (1, 1, 1)
    scene.frame_set(0)
    armature.pose.bones['Head'].scale *= proportions['head']
    scene.render.resolution_x = FRAME_PX
    render(os.path.join(out_dir, f"{config['id']}-mask.png"))

manifest_path = os.path.join(out_dir, 'manifest.json')
if only and os.path.exists(manifest_path):
    manifest = {**json.load(open(manifest_path))['animations'], **manifest}
json.dump({'frame': FRAME_PX, 'height': frame_height, 'animations': manifest}, open(manifest_path, 'w'), indent=2)
print('DONE', out_dir)
