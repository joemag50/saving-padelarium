# Diseño de los enemigos

Todos son **personas disfrazadas de alien** (empleados de una empresa de eventos), pero se vale que se vean muy alien.
Cada tipo tiene **sus propios colores**. Se arman igual que los amigos: modelo de Quaternius + piezas hechas por script
(`art/blender/build_character.py`) + `art/build.sh <id>`.

Cada enemigo ya tiene su configuración en `art/characters/<id>.json` (piezas, colores, estatura, animaciones y accesorios).
Las marcadas como "diseño" usan accesorios (`extras`, estilos de máscara) que todavía hay que programar en el script
antes de correr `art/build.sh`.

Reglas para todos:

- **Pistas de que son personas:** tenis o zapatos normales debajo del traje, piel en cuello o manos, estatura humana.
- **Máscara que se cae:** desde el nivel 4 (`MASK_REVEAL_FROM_LEVEL`), al caer sale volando la máscara y se ve a una persona normal.
  Cada uno necesita `fall` y `fall-unmasked` y la imagen de su máscara.
- **Solo las animaciones que usa:** cada tipo lista abajo las que su comportamiento en el juego reproduce, y nada más.
- **Super armadura** (Grandote, Líderes, Supremo): no reaccionan a los golpes, así que no llevan `hurt`.

| Enemigo | Estado |
|---|---|
| Invasor | ✅ `invasor.json` |
| Veloz | Diseño, `veloz.json` |
| Grandote | Diseño, `grandote.json` |
| Tirador | Diseño, `tirador.json` |
| Escudero | Diseño, `escudero.json` |
| Humero | Diseño, `humero.json` |
| Líderes de nivel (5) | Diseño, `lider-1.json` … `lider-5.json` |
| Supremo Galáctico | Diseño, `supremo.json` |

---

## Invasor (`invasor`) ✅

El básico: camina hasta ti y te da un puñetazo.

- **Look:** traje espacial morado con detalles lila y verde lima; máscara verde de alien clásico (cráneo grande, barbilla angosta,
  ojos negros almendrados) con dos antenas de bolitas rosas brillantes; tenis blancos.
- **Estatura:** 176 cm.
- **Animaciones:** `idle`, `walk`, `attack` (el juego la parte en preparación + golpe), `hurt`, `fall`, `fall-unmasked`.

## Veloz (`veloz`)

Rápido y frágil: se prepara de lejos y cruza la pantalla embistiendo.

- **Look:** delgado y más bajito, **cian** con negro; casco de visera que brilla (de piloto/ciclista) con **una aleta** encima;
  rayas de velocidad en el traje; tenis de correr.
- **Base:** traje sci-fi del paquete de mujeres (más estilizado) o el traje espacial con proporciones delgadas.
- **Estatura:** 168 cm, proporciones más delgadas (ancho ~0.95).
- **Máscara:** el casco con visera.
- **Animaciones:** `idle`, `walk`, `windup` (agachado, listo para arrancar), `dash` (correr a toda velocidad), `hurt`, `fall`, `fall-unmasked`.

## Grandote (`grandote`)

Tanque lento: mucha vida, golpe fuerte con aviso largo, no lo empujas.

- **Look:** disfraz **"inflable"** café-naranja, enorme y redondo; **un solo ojo gigante** al centro de la cabeza; brazos gruesos;
  botas de trabajo debajo.
- **Base:** traje espacial con proporciones muy anchas.
- **Estatura:** ~200 cm, ancho ~1.45.
- **Máscara:** la cabeza de un ojo.
- **Animaciones:** `idle`, `walk`, `attack` (golpe pesado, más lento), `fall`, `fall-unmasked`. Sin `hurt` (super armadura).

## Tirador (`tirador`)

Mantiene distancia y te saca pelotas de pádel por tu carril; se las puedes regresar.

- **Look:** **verde lima** con blanco, traje deportivo-espacial; máscara con visera y antenas; **raqueta de pádel** en la mano
  (hecha por script); muñequeras.
- **Base:** traje espacial + raqueta.
- **Estatura:** 175 cm.
- **Animaciones:** `idle`, `walk` (también al alejarse de ti), `serve` (el juego la parte en apuntar + saque), `hurt`
  (también cuando le regresas la pelota), `fall`, `fall-unmasked`.

## Escudero (`escudero`)

Escudo al frente: solo le haces daño por la espalda (o con el especial de pareja).

- **Look:** **azul** rey, blindado; un **escudo en el brazo con forma de platillo volador** (hecho por script) con luces;
  máscara tipo casco con cresta.
- **Base:** traje SWAT + escudo.
- **Estatura:** 180 cm.
- **Animaciones:** `idle`, `walk`, `attack` (golpe con la otra mano, el escudo siempre al frente), `hurt`, `fall`, `fall-unmasked`.
  El "¡BLOQUEADO!" se ve con un destello en el escudo, sin animación nueva.

## Humero (`humero`)

Lanza bombas de humo: marca el piso y luego sale una nube que lastima.

- **Look:** **gris** con amarillo de advertencia; **máscara antigás** alien con antenas; **máquina de humo en la espalda**
  (la mochila que ya trae el paquete) con mangueras; guantes.
- **Base:** traje espacial + mochila.
- **Estatura:** 172 cm.
- **Animaciones:** `idle`, `walk`, `throw` (lanzar la bomba), `hurt`, `fall`, `fall-unmasked`.

## Líderes de nivel (`lider-<nivel>`)

Uno por nivel, más alto e imponente; no lo empujas. Comparten cuerpo (hombreras y capa corta) y cambian color y accesorio
según el tema de su nivel:

| Nivel | Líder | Color | Accesorio |
|---|---|---|---|
| 1 | Líder del escuadrón | magenta | capa corta y hombreras |
| 2 | Comandante Vapor | verde esmeralda | tanque de vapor en la espalda, el humo verde del nivel |
| 3 | Capitana Decibel | morado | audífonos gigantes / megáfono |
| 4 | Sargento Grúa | amarillo | casco de obra con antenas, chaleco con franjas |
| 5 | Agente Firma | rojo | corbata, portafolio y pluma gigante |

- **Estatura:** ~190 cm.
- **Animaciones:** `idle`, `walk`, `attack`, `fall`, `fall-unmasked`. Sin `hurt` (super armadura).
- **Por decidir:** 5 renders con su color y accesorio (se ven mejor), o 1 render neutro teñido en el juego (pesa menos).

## Supremo Galáctico (`supremo`) — jefe final

El más grande. Al final se revela que es el **Ingeniero Galán** con un disfraz de foami.

- **Look:** armadura **dorada** con morado, capa larga, corona/antenas de "emperador galáctico" y una **raqueta enorme**.
  El disfraz se ve aparatoso a propósito (foami): bordes gruesos, brillos exagerados.
- **Base:** armadura del Rey (paquete de hombres) + capa + raqueta, proporciones anchas.
- **Estatura:** ~210 cm, ancho ~1.3.
- **Cara al quitarse la máscara:** la de Galán, un señor de bigote (la cabeza con bigote del paquete).
  Al derrotarlo **siempre** se le cae la máscara: es el momento de la revelación del nivel 6.
- **Animaciones** (según sus fases en `SupremoBoss.ts`):
  `idle`, `walk` (perseguir), `serve` (apuntar + saque, también sirve para el raquetazo cercano), `charge` (embestida),
  `raise` (brazos arriba para llamar el rayo de abducción), `stunned` (aturdido, mareado), `exhausted` (agotado, agachado),
  `fall-unmasked` (derrota con revelación).
