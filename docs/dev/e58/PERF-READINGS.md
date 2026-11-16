# E53 readings on the owner's PC (E58 L1, step 5)

Raw output of `game.drpg.perf()` and `await game.drpg.fps({ toChat: false })`, 16.11.2026, at 80dfaf06 (1.2.116 with
this line's step 3; `perfReport` and `frameCost` unchanged since the release). These numbers go to the coordinator for
C2; none of them is a budget. Read LOCAL-REPORT.md step 5 first: the first run's frame times are the browser's, not the
module's.

- Machine: AMD Ryzen 9 9900X (12 cores, 24 threads), 31.6 GB RAM visible to WSL2 (kernel 6.18.58.1-microsoft-standard-WSL2),
  NVIDIA GeForce RTX 4080 SUPER.
- Browser: Playwright 1.56.1's Chromium 141.0.7390.37, headed on WSLg (DISPLAY :0), `--use-gl=angle --use-angle=gl`,
  `GALLIUM_DRIVER=d3d12`, `MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`; WebGL renderer read in the page: "ANGLE (Microsoft
  Corporation, D3D12 (NVIDIA GeForce RTX 4080 SUPER), OpenGL 4.6)" - hardware, through WSLg's D3D12 translation, not a
  native Windows browser. Foundry's own notice says Chromium 141 is older than the 146 it wants.
- World: drpg-qa-gate, the academy (the seed's scene, 4000x3000, not isometric, token vision off), the world paused
  (Foundry's start), 1366x768, device pixel ratio 1.

## Run 1: the four accounts in four headed windows, perf() and fps() on the GM and PlayerOne, both themes

#### stainedGlass, the GM, perf()

```
Screen 1366 x 768, device pixel ratio 1
Frames averaged over 60

As it stands          42.64 ms/frame  (23 fps)
With the pulse held   43.79 ms/frame  (23 fps)
The pulse costs       -1.15 ms/frame
With the blur held    43.32 ms/frame  (23 fps)
The blur costs        -0.68 ms/frame
A window reaches the screen in   86.7 ms (median of six)
One recut of the glass   7.23 ms

The module's own hot lookups, per call:
  roomOfActor          0.1 ms
  othersInRoom        0.19 ms

Rolls the GM drew (the last fifty this browser took part in):
  drawn here, packet in to answer out: none since this browser loaded
  drawn for this browser, asked to dice shown: none since this browser loaded
  drawn for this browser, asked to dice started: none since this browser loaded

What the table's own work cost on this browser (the last fifty of each, since it loaded):
  a student's ring drawn again: 21, p50       0 ms, p95     1.7 ms, slowest     2.8 ms
  a Remnant's ring drawn again: none since this browser loaded
  the fog repainted: 3, p50     8.7 ms, p95    33.2 ms, slowest    33.2 ms
  the case dashboard rebuilt in place: none since this browser loaded
  a chat card painted (the module's pass, not Foundry's render): 45, p50       0 ms, p95     0.4 ms, slowest    14.8 ms
  the canvas drawn, any scene: none since this browser loaded
  the canvas drawn entering the trial hall: none since this browser loaded
  the canvas drawn leaving the trial hall: none since this browser loaded
  a sheet write judged by the GMs' audit: none since this browser loaded
  a sheet write waiting for its judgement: none since this browser loaded

A frame budget is 16.7 ms at 60 Hz. Anything the theme costs is spent
on top of whatever Foundry and the system are doing with the same frame.
```

#### stainedGlass, PlayerOne, perf()

```
Screen 1366 x 768, device pixel ratio 1
Frames averaged over 60

As it stands          43.09 ms/frame  (23 fps)
With the pulse held   42.54 ms/frame  (24 fps)
The pulse costs        0.55 ms/frame
With the blur held    42.63 ms/frame  (23 fps)
The blur costs         0.46 ms/frame
A window reaches the screen in   86.8 ms (median of six)
One recut of the glass   6.06 ms

The module's own hot lookups, per call:
  roomOfActor         0.12 ms
  othersInRoom        0.14 ms

Rolls the GM drew (the last fifty this browser took part in):
  drawn here, packet in to answer out: none since this browser loaded
  drawn for this browser, asked to dice shown: none since this browser loaded
  drawn for this browser, asked to dice started: none since this browser loaded

What the table's own work cost on this browser (the last fifty of each, since it loaded):
  a student's ring drawn again: 7, p50     0.9 ms, p95     1.9 ms, slowest     1.9 ms
  a Remnant's ring drawn again: none since this browser loaded
  the fog repainted: 2, p50     0.4 ms, p95    50.7 ms, slowest    50.7 ms
  the case dashboard rebuilt in place: none since this browser loaded
  a chat card painted (the module's pass, not Foundry's render): 23, p50     0.1 ms, p95     0.4 ms, slowest       7 ms
  the canvas drawn, any scene: none since this browser loaded
  the canvas drawn entering the trial hall: none since this browser loaded
  the canvas drawn leaving the trial hall: none since this browser loaded
  the GMs' audit of a sheet write: not measured here - it runs on the primary GM's browser

A frame budget is 16.7 ms at 60 Hz. Anything the theme costs is spent
on top of whatever Foundry and the system are doing with the same frame.
```

#### stainedGlass, the GM, fps({ toChat: false })

```
Screen 1366 x 768, device pixel ratio 1; Stained Glass
Watched 5 s: 111 frames, 22 fps; median 50 ms, p95 50.1 ms; 111 over 33 ms, 32 over 50 ms
On the canvas now: 10 filter(s) (1 blur) on 9 object(s), 9 mask(s) - (unnamed) 4, PrimaryCanvasGroup 1, FullCanvasObject 2, CanvasIlluminationEffects 1, CanvasDarknessEffects 1, InterfaceCanvasGroup 1
Foundry's own filters (and other modules'), read and not held: 10 filter(s) on 9 object(s)
Seams' light drawn once (E88 C1): 1 texture(s) worn by 3 ring(s)

The module's work in that window (count, per second):
  fog.driftTick                        112     22.39/s
  fog.held.backdrop                     41      8.19/s
  fog.held.raster                       41      8.19/s
  glass.pulseFrame                      56     11.19/s
  glass.pulseFrame.panes              1456    291.01/s

Each held alone for up to 60 frames or 1 s, against 44.53 ms/frame as it stands:
  the room outline's live halo filters nothing of it here
  the room outline's baked light       43.51 ms/frame,    1.02 ms less
  the ring halos' live filters       nothing of it here
  the ring halos' baked light          41.43 ms/frame,     3.1 ms less
  the fog raster and the backdrop      44.32 ms/frame,    0.21 ms less
  the drift callback                   46.09 ms/frame,   -1.56 ms less
  the blur (drpg-no-blur)              46.23 ms/frame,    -1.7 ms less
  the pulse (drpg-no-pulse)            43.33 ms/frame,     1.2 ms less
  the ticker (drpg-no-ticker)          45.73 ms/frame,    -1.2 ms less
  the endless CSS animations           45.94 ms/frame,   -1.41 ms less
  the canvas (its ticker stopped)       38.3 ms/frame,    6.23 ms less

A frame budget is 16.7 ms at 60 Hz. "ms less" is one reading against one other on this machine;
run it twice and read the two together.
```

#### stainedGlass, PlayerOne, fps({ toChat: false })

```
Screen 1366 x 768, device pixel ratio 1; Stained Glass
Watched 5 s: 117 frames, 23 fps; median 50 ms, p95 50.1 ms; 117 over 33 ms, 22 over 50 ms
On the canvas now: 11 filter(s) (1 blur) on 10 object(s), 9 mask(s) - (unnamed) 5, PrimaryCanvasGroup 1, FullCanvasObject 2, CanvasIlluminationEffects 1, CanvasDarknessEffects 1, InterfaceCanvasGroup 1
Foundry's own filters (and other modules'), read and not held: 11 filter(s) on 10 object(s)
Seams' light drawn once (E88 C1): 1 texture(s) worn by 1 ring(s)

The module's work in that window (count, per second):
  fog.driftTick                        118     23.59/s
  fog.held.backdrop                     41       8.2/s
  fog.held.raster                       41       8.2/s
  glass.pulseFrame                      59     11.79/s
  glass.pulseFrame.panes              1121    224.07/s

Each held alone for up to 60 frames or 1 s, against 44.09 ms/frame as it stands:
  the room outline's live halo filters nothing of it here
  the room outline's baked light       43.87 ms/frame,    0.22 ms less
  the ring halos' live filters       nothing of it here
  the ring halos' baked light          42.94 ms/frame,    1.15 ms less
  the fog raster and the backdrop      42.28 ms/frame,    1.81 ms less
  the drift callback                   41.56 ms/frame,    2.53 ms less
  the blur (drpg-no-blur)              45.06 ms/frame,   -0.97 ms less
  the pulse (drpg-no-pulse)            44.36 ms/frame,   -0.27 ms less
  the ticker (drpg-no-ticker)          43.07 ms/frame,    1.02 ms less
  the endless CSS animations           44.99 ms/frame,    -0.9 ms less
  the canvas (its ticker stopped)      39.13 ms/frame,    4.96 ms less

A frame budget is 16.7 ms at 60 Hz. "ms less" is one reading against one other on this machine;
run it twice and read the two together.
```

#### monokumaLegacy, the GM, perf()

```
Screen 1366 x 768, device pixel ratio 1
Frames averaged over 60

As it stands          34.31 ms/frame  (29 fps)
Monokuma Legacy: no curtain, no pulse.
A window reaches the screen in   69.9 ms (median of six)

The module's own hot lookups, per call:
  roomOfActor         0.12 ms
  othersInRoom        0.13 ms

Rolls the GM drew (the last fifty this browser took part in):
  drawn here, packet in to answer out: none since this browser loaded
  drawn for this browser, asked to dice shown: none since this browser loaded
  drawn for this browser, asked to dice started: none since this browser loaded

What the table's own work cost on this browser (the last fifty of each, since it loaded):
  a student's ring drawn again: 6, p50       0 ms, p95     0.1 ms, slowest     0.1 ms
  a Remnant's ring drawn again: none since this browser loaded
  the fog repainted: 3, p50     6.8 ms, p95      35 ms, slowest      35 ms
  the case dashboard rebuilt in place: none since this browser loaded
  a chat card painted (the module's pass, not Foundry's render): 45, p50       0 ms, p95     0.1 ms, slowest     4.3 ms
  the canvas drawn, any scene: none since this browser loaded
  the canvas drawn entering the trial hall: none since this browser loaded
  the canvas drawn leaving the trial hall: none since this browser loaded
  a sheet write judged by the GMs' audit: none since this browser loaded
  a sheet write waiting for its judgement: none since this browser loaded

A frame budget is 16.7 ms at 60 Hz. Anything the theme costs is spent
on top of whatever Foundry and the system are doing with the same frame.
```

#### monokumaLegacy, PlayerOne, perf()

```
Screen 1366 x 768, device pixel ratio 1
Frames averaged over 60

As it stands          34.73 ms/frame  (29 fps)
Monokuma Legacy: no curtain, no pulse.
A window reaches the screen in   74.3 ms (median of six)

The module's own hot lookups, per call:
  roomOfActor         0.08 ms
  othersInRoom        0.14 ms

Rolls the GM drew (the last fifty this browser took part in):
  drawn here, packet in to answer out: none since this browser loaded
  drawn for this browser, asked to dice shown: none since this browser loaded
  drawn for this browser, asked to dice started: none since this browser loaded

What the table's own work cost on this browser (the last fifty of each, since it loaded):
  a student's ring drawn again: 2, p50       0 ms, p95     0.2 ms, slowest     0.2 ms
  a Remnant's ring drawn again: none since this browser loaded
  the fog repainted: 2, p50     0.4 ms, p95    38.1 ms, slowest    38.1 ms
  the case dashboard rebuilt in place: none since this browser loaded
  a chat card painted (the module's pass, not Foundry's render): 23, p50     0.1 ms, p95     0.7 ms, slowest     3.2 ms
  the canvas drawn, any scene: none since this browser loaded
  the canvas drawn entering the trial hall: none since this browser loaded
  the canvas drawn leaving the trial hall: none since this browser loaded
  the GMs' audit of a sheet write: not measured here - it runs on the primary GM's browser

A frame budget is 16.7 ms at 60 Hz. Anything the theme costs is spent
on top of whatever Foundry and the system are doing with the same frame.
```

#### monokumaLegacy, the GM, fps({ toChat: false })

```
Screen 1366 x 768, device pixel ratio 1; Monokuma Legacy
Watched 5.02 s: 143 frames, 28 fps; median 33.4 ms, p95 50.1 ms; 139 over 33 ms, 8 over 50 ms
On the canvas now: 10 filter(s) (1 blur) on 9 object(s), 9 mask(s) - (unnamed) 4, PrimaryCanvasGroup 1, FullCanvasObject 2, CanvasIlluminationEffects 1, CanvasDarknessEffects 1, InterfaceCanvasGroup 1
Foundry's own filters (and other modules'), read and not held: 10 filter(s) on 9 object(s)
Seams' light drawn once (E88 C1): 0 texture(s) worn by 0 ring(s)

The module's work in that window (count, per second):
  fog.driftTick                        144     28.69/s
  fog.held.backdrop                     47      9.36/s
  fog.held.raster                       47      9.36/s

Each held alone for up to 60 frames or 1 s, against 33.54 ms/frame as it stands:
  the room outline's live halo filters nothing of it here
  the room outline's baked light     nothing of it here
  the ring halos' live filters       nothing of it here
  the ring halos' baked light        nothing of it here
  the fog raster and the backdrop      32.43 ms/frame,    1.11 ms less
  the drift callback                   35.02 ms/frame,   -1.48 ms less
  the blur (drpg-no-blur)            nothing of it here
  the pulse (drpg-no-pulse)          nothing of it here
  the ticker (drpg-no-ticker)          34.58 ms/frame,   -1.05 ms less
  the endless CSS animations           35.77 ms/frame,   -2.24 ms less
  the canvas (its ticker stopped)      30.13 ms/frame,    3.41 ms less

A frame budget is 16.7 ms at 60 Hz. "ms less" is one reading against one other on this machine;
run it twice and read the two together.
```

#### monokumaLegacy, PlayerOne, fps({ toChat: false })

```
Screen 1366 x 768, device pixel ratio 1; Monokuma Legacy
Watched 5.02 s: 156 frames, 31 fps; median 33.3 ms, p95 33.5 ms; 139 over 33 ms, 4 over 50 ms
On the canvas now: 11 filter(s) (1 blur) on 10 object(s), 9 mask(s) - (unnamed) 5, PrimaryCanvasGroup 1, FullCanvasObject 2, CanvasIlluminationEffects 1, CanvasDarknessEffects 1, InterfaceCanvasGroup 1
Foundry's own filters (and other modules'), read and not held: 11 filter(s) on 10 object(s)
Seams' light drawn once (E88 C1): 0 texture(s) worn by 0 ring(s)

The module's work in that window (count, per second):
  fog.driftTick                        157     31.28/s
  fog.held.backdrop                     48      9.56/s
  fog.held.raster                       48      9.56/s

Each held alone for up to 60 frames or 1 s, against 31.85 ms/frame as it stands:
  the room outline's live halo filters nothing of it here
  the room outline's baked light     nothing of it here
  the ring halos' live filters       nothing of it here
  the ring halos' baked light        nothing of it here
  the fog raster and the backdrop      32.78 ms/frame,   -0.93 ms less
  the drift callback                   33.33 ms/frame,   -1.48 ms less
  the blur (drpg-no-blur)            nothing of it here
  the pulse (drpg-no-pulse)          nothing of it here
  the ticker (drpg-no-ticker)          33.96 ms/frame,    -2.1 ms less
  the endless CSS animations           35.34 ms/frame,   -3.48 ms less
  the canvas (its ticker stopped)      30.78 ms/frame,    1.07 ms less

A frame budget is 16.7 ms at 60 Hz. "ms less" is one reading against one other on this machine;
run it twice and read the two together.
```

## Run 2: the GM alone, one focused window, fps() in both themes

#### stainedGlass, the GM alone in one focused window, fps({ toChat: false })

```
Screen 1366 x 768, device pixel ratio 1; Stained Glass
Watched 5 s: 300 frames, 60 fps; median 16.7 ms, p95 16.8 ms; 0 over 33 ms, 0 over 50 ms
On the canvas now: 10 filter(s) (1 blur) on 9 object(s), 9 mask(s) - (unnamed) 4, PrimaryCanvasGroup 1, FullCanvasObject 2, CanvasIlluminationEffects 1, CanvasDarknessEffects 1, InterfaceCanvasGroup 1
Foundry's own filters (and other modules'), read and not held: 10 filter(s) on 9 object(s)
Seams' light drawn once (E88 C1): 1 texture(s) worn by 3 ring(s)

The module's work in that window (count, per second):
  fog.driftTick                        296     59.16/s
  fog.held.backdrop                     50      9.99/s
  fog.held.raster                       50      9.99/s
  glass.pulseFrame                      75     14.99/s
  glass.pulseFrame.panes              1950    389.76/s

Each held alone for up to 60 frames or 1 s, against 16.66 ms/frame as it stands:
  the room outline's live halo filters nothing of it here
  the room outline's baked light       16.67 ms/frame,   -0.01 ms less
  the ring halos' live filters       nothing of it here
  the ring halos' baked light          16.68 ms/frame,   -0.02 ms less
  the fog raster and the backdrop      16.68 ms/frame,   -0.02 ms less
  the drift callback                   16.67 ms/frame,   -0.02 ms less
  the blur (drpg-no-blur)              16.81 ms/frame,   -0.15 ms less
  the pulse (drpg-no-pulse)            16.67 ms/frame,   -0.01 ms less
  the ticker (drpg-no-ticker)          16.68 ms/frame,   -0.02 ms less
  the endless CSS animations           16.69 ms/frame,   -0.03 ms less
  the canvas (its ticker stopped)      16.68 ms/frame,   -0.02 ms less

A frame budget is 16.7 ms at 60 Hz. "ms less" is one reading against one other on this machine;
run it twice and read the two together.
```

#### monokumaLegacy, the GM alone in one focused window, fps({ toChat: false })

```
Screen 1366 x 768, device pixel ratio 1; Monokuma Legacy
Watched 5 s: 300 frames, 60 fps; median 16.7 ms, p95 16.8 ms; 0 over 33 ms, 0 over 50 ms
On the canvas now: 10 filter(s) (1 blur) on 9 object(s), 9 mask(s) - (unnamed) 4, PrimaryCanvasGroup 1, FullCanvasObject 2, CanvasIlluminationEffects 1, CanvasDarknessEffects 1, InterfaceCanvasGroup 1
Foundry's own filters (and other modules'), read and not held: 10 filter(s) on 9 object(s)
Seams' light drawn once (E88 C1): 0 texture(s) worn by 0 ring(s)

The module's work in that window (count, per second):
  fog.driftTick                        295     58.96/s
  fog.held.backdrop                     50      9.99/s
  fog.held.raster                       50      9.99/s

Each held alone for up to 60 frames or 1 s, against 16.69 ms/frame as it stands:
  the room outline's live halo filters nothing of it here
  the room outline's baked light     nothing of it here
  the ring halos' live filters       nothing of it here
  the ring halos' baked light        nothing of it here
  the fog raster and the backdrop      16.68 ms/frame,    0.01 ms less
  the drift callback                   16.68 ms/frame,       0 ms less
  the blur (drpg-no-blur)            nothing of it here
  the pulse (drpg-no-pulse)          nothing of it here
  the ticker (drpg-no-ticker)          16.63 ms/frame,    0.06 ms less
  the endless CSS animations           16.96 ms/frame,   -0.27 ms less
  the canvas (its ticker stopped)      16.68 ms/frame,    0.01 ms less

A frame budget is 16.7 ms at 60 Hz. "ms less" is one reading against one other on this machine;
run it twice and read the two together.
```
