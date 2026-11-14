# mods-fiordo

Dos mods para la app de escritorio de Claude Code:

| Mod | Qué hace |
|---|---|
| `fondo-vivo` | Tema «Fiordo»: colores teñidos de azul glaciar y una aurora animada detrás de la conversación. Resumen al acabar respuestas largas. |
| `barra-uso` | Barra sobre el prompt con contexto, límite de 5 h y de 7 d (anillos animados, color por umbral), avisos al 80/90/95 % con qué gasta y una sugerencia. |

## Antes de instalar (Windows)

El fondo solo se ve con estos dos ajustes activos:
Configuración de Windows → Accesibilidad → Efectos visuales → **Efectos de transparencia** y **Efectos de animación**. Reinicia la app después.

## Instalar

En una sesión de la app o de la terminal, escribe:

```
/plugin install fondo-vivo --marketplace Rodrii777/claude-mods-fiordo
/plugin install barra-uso --marketplace Rodrii777/claude-mods-fiordo
```

Acepta añadir el marketplace (`y`) y elige el alcance `user` para que valga en todas las sesiones. Desde un shell:

```
claude plugin install fondo-vivo --marketplace Rodrii777/claude-mods-fiordo
claude plugin install barra-uso --marketplace Rodrii777/claude-mods-fiordo
```

Luego abre una sesión nueva o escribe `/reload-plugins`.

**Si ya tienes otro tema o mod de apariencia**, desactívalo antes (`claude plugin disable <nombre>`): dos mods que ponen fondo o colores se pisan.

## Comandos

`/fondo-vivo ayuda` lista todo. Los principales:

| Comando | Efecto |
|---|---|
| `/fondo-vivo dia`, `noche`, `auto` | Fija la escena de día, de noche o sigue el modo de la app |
| `/fondo-vivo anima on\|off` | Enciende o apaga la animación |
| `/fondo-vivo ux on\|off` | Línea de estado con la duración de la respuesta |
| `/fondo-vivo resumen on\|off` | Toast al acabar respuestas de 90 s o más |
| `/fondo-vivo apagar`, `encender` | Quita o devuelve el tema |
| `/barra-uso` | Alterna la barra nueva y la clásica de texto |

## Límites

- Un mod no puede cambiar la tipografía ni la estructura de la app, ni hacer translúcidas la barra lateral y el panel derecho.
- El fondo animado se dibuja solo en la app de escritorio y la móvil, no en la terminal.
- Sin red ni telemetría: ambos mods solo leen el estado local de la sesión.
- `barra-uso` busca además logs `render-*.log` en `out/` para mostrar «render en curso»; si no existen, lo ignora.

## Desinstalar

```
claude plugin uninstall fondo-vivo
claude plugin uninstall barra-uso
```
