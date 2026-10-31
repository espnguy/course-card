// Viewport matrix. The four Duo sizes come from the brief; phone/desktop are
// the control sizes that must NOT change.
module.exports = {
  SIZES: [
    { name: '382x580-duo-cover',  w: 382,  h: 580,  duo: true  },
    { name: '669x825-duo-inner',  w: 669,  h: 825,  duo: true  },
    { name: '870x669-duo-inner',  w: 870,  h: 669,  duo: true  },
    { name: '951x543-duo-inner',  w: 951,  h: 543,  duo: true  },
    { name: '390x844-phone',      w: 390,  h: 844,  duo: false },
    { name: '1440x900-desktop',   w: 1440, h: 900,  duo: false }
  ],
  // The seven tabs are this app's "pages".
  TABS: ['plan', 'yards', 'lies', 'chips', 'slopechips', 'grain', 'sand'],
  BASE: 'http://localhost:8125'
};
