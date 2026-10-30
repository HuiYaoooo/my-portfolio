/* Deterministic ripple origins for the five-second opening.
   Only rain-intro.js renders the expanding surface waves. */
(() => {
  "use strict";

  function create(width, height) {
    const mobile = Math.max(1, Number(width)) < 600;
    let seed = 7717;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const impacts = [
      { x: .51, y: .43, time: .68, power: 1.65 },
      { x: .26, y: .60, time: 1.02, power: 1.05 },
      { x: .78, y: .31, time: 1.13, power: .88 },
      { x: .65, y: .76, time: 1.21, power: .86 }
    ];
    const total = mobile ? 364 : 564;
    for (let i = 4; i < total; i++) {
      const fraction = (i - 4 + random() * .7) / (total - 4);
      // Sparse opening waves build into a dense field of overlapping ripples.
      const time = 1.09 + Math.pow(fraction, .73) * 3.02;
      impacts.push({
        x: .008 + random() * .984,
        y: .055 + random() * .93,
        time,
        power: .22 + random() * .48
      });
    }
    impacts.sort((a, b) => a.time - b.time);
    return { impacts };
  }

  window.RainStorm = { create };
})();
