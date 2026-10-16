# Arte de personajes

Los amigos se arman en Blender a partir de modelos gratuitos y se renderizan como tiras de sprites.

- `characters/<id>.json`: cómo es cada amigo (modelo base, piezas, colores, estatura, gorra…).
  Accesorios hechos por script: `cap`, `glasses`, `headband`, `wristbands`, `bracelets`, `earrings`, `mustache`,
  `dreads`, `curls`, `longHair`, `hairFill`, `rastaHat`, `skirt`, `alienMask` (estilos `default`, `cyclops`, `crest`,
  `gasmask`, `helmet`, `emperor`; con `headphones` o `hardHat` encima), y de enemigos: `racket`, `shield`, `cape`,
  `shoulderPads`, `steamTank`, `hazardStripes`, `tie`, `briefcase`, `giantPen`, `belly`. También `partColors` (un color solo en una pieza),
  `paint` (pintar una zona: calceta, pantalón brincacharcos) y `deleteMaterials` (quitar, p. ej., un sombrero).
- `blender/build_character.py`: arma al personaje, le aplica el estilo de la casa (sombreado de caricatura, contorno, proporciones) y renderiza cada animación con la misma cámara para todos.
- `build.sh <id>`: corre todo y deja las tiras en `public/assets/characters/<id>/` y vistas previas en `art/preview/`.
- `source/`: modelos base.

Para agregar a un amigo: copia `characters/jose.json`, cámbialo, corre `art/build.sh <id>` y agrega su id y su altura en el cuadro en `CHARACTER_HEIGHTS` (`src/player/heroAssets.ts`).

## Licencias

- `source/Quaternius_Modular_Men.blend`: "Ultimate Modular Men" de [Quaternius](https://quaternius.com), CC0 (dominio público).
- `source/Quaternius_Modular_Women.blend`: "Ultimate Modular Women" de [Quaternius](https://quaternius.com), CC0 (dominio público).
