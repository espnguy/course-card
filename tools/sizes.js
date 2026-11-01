// Viewport matrix: the iPhone Duo's cover screen and its three inner-screen
// postures. This is the only device the card is used on, so nothing else is
// tested. Add a row here if that ever changes.
module.exports = {
  SIZES: [
    { name: '382x580-duo-cover',  w: 382, h: 580, duo: true },
    { name: '669x825-duo-inner',  w: 669, h: 825, duo: true },
    { name: '870x669-duo-inner',  w: 870, h: 669, duo: true },
    { name: '951x543-duo-inner',  w: 951, h: 543, duo: true }
  ],
  // The seven tabs are this app's "pages".
  TABS: ['plan', 'yards', 'lies', 'chips', 'slopechips', 'grain', 'sand'],
  BASE: 'http://localhost:8125'
};
