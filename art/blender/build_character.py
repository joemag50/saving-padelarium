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


def material_for(original_name):
    if original_name not in materials:
        color = config['colors'].get(original_name)
        if color is None:
            # Keep the pack's own color (eyes, etc.).
            src = bpy.data.materials[original_name]
            bsdf = next((n for n in src.node_tree.nodes if n.type in ('BSDF_PRINCIPLED', 'BSDF_DIFFUSE')), None)
            c = bsdf.inputs[0].default_value if bsdf else (0.5, 0.5, 0.5, 1)
            to_srgb = lambda v: v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
            color = '#%02x%02x%02x' % tuple(round(max(0, min(1, to_srgb(c[i]))) * 255) for i in range(3))
        materials[original_name] = toon_material(original_name, color)
    return materials[original_name]


for obj in meshes:
    for slot in obj.material_slots:
        if slot.material:
            slot.material = material_for(slot.material.name)


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


def ride_head(obj):
    """Parent to the head bone, keeping its place, so it follows every animation."""
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = 'BONE'
    obj.parent_bone = 'Head'
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

# Alien costume head: a big rubber mask with almond eyes and antennae, worn over a real head.
mask_parts = []
if 'alienMask' in config:
    mask_cfg = config['alienMask']
    width = head_hi.x - head_lo.x
    center = (head_lo + head_hi) / 2
    r = width * 0.78
    mask_mesh = bpy.data.meshes.new('mask')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=r)
    for v in bm.verts:
        # Tall dome on top, narrowing into a small chin (the classic "grey" head).
        v.co.z *= 1.25 if v.co.z > 0 else 1.05
        if v.co.z < 0:
            taper = 1 + (v.co.z / r) * 0.62
            v.co.x *= taper
            v.co.y *= taper
    bm.to_mesh(mask_mesh)
    bm.free()
    mask = add_object('mask', mask_mesh, mask_cfg['color'])
    mask.location = (center.x, center.y, center.z + r * 0.12)
    mask_parts.append(mask)
    # Eyes: big black almonds on the face side (-Y), tilted outward.
    for side in (-1, 1):
        # Sitting on the surface (not inside it), wrapping around toward the sides.
        eye = ellipsoid('mask_eye', mask_cfg.get('eyeColor', '#0b0b12'), r * 0.44, (1.0, 0.42, 0.62),
                        (center.x + side * r * 0.46, center.y - r * 0.78, center.z + r * 0.16))
        eye.rotation_euler = (0, math.radians(-28 * side), math.radians(35 * side))
        mask_parts.append(eye)
    # Antennae: thin stalks with glowing tips.
    for side in (-1, 1):
        stalk = ellipsoid('antenna', mask_cfg['color'], r * 0.06, (1, 1, 6),
                          (center.x + side * r * 0.35, center.y + r * 0.1, center.z + r * 1.55), (8, 6))
        stalk.rotation_euler = (0, math.radians(18 * side), 0)
        tip = ellipsoid('antenna_tip', mask_cfg.get('glowColor', '#f0abfc'), r * 0.16, (1, 1, 1),
                        (center.x + side * r * 0.47, center.y + r * 0.1, center.z + r * 1.95), (10, 8))
        mask_parts += [stalk, tip]
    for part in mask_parts:
        ride_head(part)
    meshes += mask_parts

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
cam.data.ortho_scale = reference_height * 1.45
# The scale is the frame's height, so wider frames (falls) keep the same size per pixel.
cam.data.sensor_fit = 'VERTICAL'
elev = math.radians(CAMERA_ELEVATION_DEG)
dist = 10
# Feet sit near the bottom of the frame: aim the camera above them.
target = Vector((0, 0, reference_height * 0.62))
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
scene.render.resolution_y = FRAME_PX
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
json.dump({'frame': FRAME_PX, 'animations': manifest}, open(manifest_path, 'w'), indent=2)
print('DONE', out_dir)
