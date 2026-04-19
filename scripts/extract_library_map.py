"""Extract the Oak Hill College Library room from generative_agents Tiled map.
Run from D:\\code\\chat-team root.
"""
import json
import os

SRC = r"D:\code\generative_agents\environment\frontend_server\static_dirs\assets\the_ville\visuals\the_ville_jan7.json"
DST = r"frontend\public\assets\maps\library.json"

# Library room bounds in the source map (inclusive)
X1, Y1, X2, Y2 = 118, 19, 124, 29
ROOM_W = X2 - X1 + 1  # 7
ROOM_H = Y2 - Y1 + 1  # 11

# Renderable layers only (exclude collision/arena/sector/spawn/meta layers)
RENDER_LAYERS = [
    "Bottom Ground", "Interior Ground", "Wall",
    "Interior Furniture L1", "Interior Furniture L2 ",
    "Foreground L1", "Foreground L2",
]


def extract():
    with open(SRC, "r") as f:
        src = json.load(f)

    src_w = src["width"]  # 140

    # Build tilesets list
    tilesets = []
    for ts in src["tilesets"]:
        tilesets.append({
            "firstgid": ts["firstgid"],
            "image": ts["image"].replace("../../../../visuals/map_assets/v1/", "../tilesets/")
                              .replace("../../../../visuals/map_assets/blocks/", "../tilesets/"),
            "imageWidth": ts.get("imageWidth", ts.get("imagewidth", 0)),
            "imageHeight": ts.get("imageHeight", ts.get("imageheight", 0)),
            "tileWidth": ts.get("tileWidth", ts.get("tilewidth", 32)),
            "tileHeight": ts.get("tileHeight", ts.get("tileheight", 32)),
            "tileCount": ts.get("tileCount", ts.get("tilecount", 0)),
            "columns": ts.get("columns", 0),
            "name": ts["name"],
        })

    # Extract renderable layers
    layers = []
    for layer in src["layers"]:
        if layer["name"] not in RENDER_LAYERS:
            continue
        if "data" not in layer:
            continue

        src_data = layer["data"]
        room_data = []
        for y in range(Y1, Y2 + 1):
            for x in range(X1, X2 + 1):
                idx = y * src_w + x
                room_data.append(src_data[idx])

        layers.append({
            "data": room_data,
            "height": ROOM_H,
            "width": ROOM_W,
            "name": layer["name"],
            "opacity": layer.get("opacity", 1),
            "type": "tilelayer",
            "visible": layer.get("visible", True),
            "x": 0,
            "y": 0,
        })

    out = {
        "compressionlevel": -1,
        "height": ROOM_H,
        "infinite": False,
        "layers": layers,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tileheight": 32,
        "tilewidth": 32,
        "tilesets": tilesets,
        "type": "map",
        "version": "1.10",
        "width": ROOM_W,
    }

    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, "w") as f:
        json.dump(out, f, indent=2)

    print(f"Extracted {ROOM_W}x{ROOM_H} library map to {DST}")
    print(f"Layers: {[l['name'] for l in layers]}")


if __name__ == "__main__":
    extract()
