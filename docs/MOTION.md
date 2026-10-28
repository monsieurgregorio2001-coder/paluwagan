# Room motion

Lines for the hub's house/MOTION.md, which lists every animation in every repo. Each uses house tokens only. Calm is data-motion="calm" or OS reduced motion with no stored choice.

| Animation | Purpose | Tokens | Calm |
| --- | --- | --- | --- |
| RECONCILED stamp | The room's one expressive moment. The stamp lands when the books balance. | `--h-spring-bouncy`, 560 ms | 160 ms opacity fade, no scale or turn. |
| Cycle strike | A line draws through each cycle as it matches. Transform only. | `--h-dur-ui`, `--h-ease-out` | 160 ms fade. |
| Cycle row in | Each checked cycle fades in. | `--h-dur-quick`, `--h-ease-out` | 160 ms fade. |
| Count to zero | The "Left to check" figure counts down between cycles. | requestAnimationFrame, under 260 ms per step | Jumps to the value. |
| Cycle stepping | The check reveals one cycle every 260 ms. | timer | All cycles show at once. |
| Shell crossfade | The static #room-hero fades out as React takes over. | `--h-dur-quick`, `--h-ease-out` | 160 ms. |
| Page fade in | A route's content fades in. | `--h-dur-quick`, `--h-ease-out` | 160 ms. |
