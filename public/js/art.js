// Цветные картинки для вариантов ответа. Рисуются в сетке 24×24, заливки плотные,
// формы скруглённые — та же манера, что у львёнка и аватаров.

const A = {
  yes: {
    ru: 'правда да верно галочка',
    svg: '<circle cx="12" cy="12" r="9.5" fill="#4CC96A"/><path d="m7.5 12.3 3.2 3.2 6-6.4" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  no: {
    ru: 'ложь нет неверно крестик',
    svg: '<circle cx="12" cy="12" r="9.5" fill="#E63946"/><path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
  },
  moon: {
    ru: 'луна ночь',
    svg: '<path d="M16.8 15.6A7.5 7.5 0 0 1 8.4 4.2a8.5 8.5 0 1 0 11.4 11.4 7.6 7.6 0 0 1-3 0Z" fill="#FFD84D"/><circle cx="18.5" cy="5.5" r="1.2" fill="#FFF0B8"/><circle cx="15" cy="3.5" r=".8" fill="#FFF0B8"/>'
  },
  sunrise: {
    ru: 'рассвет утро',
    svg: '<path d="M12 7a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5Z" fill="#FFB03A"/><path d="M3 14.5h18M5.5 18h13" stroke="#7FC7E8" stroke-width="2" stroke-linecap="round"/><path d="M12 2.5v2M4.6 6.1l1.4 1.4M19.4 6.1 18 7.5" stroke="#FFC93C" stroke-width="2" stroke-linecap="round"/>'
  },
  sun: {
    ru: 'солнце день',
    svg: '<circle cx="12" cy="12" r="5" fill="#FFC93C"/><path d="M12 2.2v2.6M12 19.2v2.6M21.8 12h-2.6M4.8 12H2.2M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8M18.9 18.9l-1.8-1.8M6.9 6.9 5.1 5.1" stroke="#FFB03A" stroke-width="2.2" stroke-linecap="round"/>'
  },
  evening: {
    ru: 'вечер город',
    svg: '<path d="M3 20V11l3.5-2.5V20zM8.5 20V7l4-3 4 3v13zM18 20v-7l3 2v5z" fill="#6C63FF"/><rect x="10.5" y="9" width="1.8" height="1.8" rx=".4" fill="#FFE08A"/><rect x="13.5" y="9" width="1.8" height="1.8" rx=".4" fill="#FFE08A"/><rect x="10.5" y="13" width="1.8" height="1.8" rx=".4" fill="#FFE08A"/><circle cx="19.5" cy="5" r="2" fill="#FFD84D"/>'
  },
  scales: {
    ru: 'весы вес',
    svg: '<path d="M12 4v14" stroke="#8FA0B8" stroke-width="2" stroke-linecap="round"/><path d="M5 8h14" stroke="#8FA0B8" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="4.4" r="1.6" fill="#8FA0B8"/><path d="M8.5 19.5h7" stroke="#8FA0B8" stroke-width="2" stroke-linecap="round"/><path d="M2 12.5a3 3 0 0 0 6 0L5 8z" fill="#7FD6D2"/><path d="M16 12.5a3 3 0 0 0 6 0L19 8z" fill="#7FD6D2"/>'
  },
  ruler: {
    ru: 'линейка рост см',
    svg: '<rect x="3" y="9" width="18" height="6" rx="1.4" fill="#FFC93C"/><path d="M6.5 9v2.6M10 9v3.6M13.5 9v2.6M17 9v3.6" stroke="#B4842A" stroke-width="1.6" stroke-linecap="round"/>'
  },
  footprints: {
    ru: 'следы ножки шаг',
    svg: '<ellipse cx="8" cy="12" rx="3.2" ry="4.4" fill="#FF9AB8"/><circle cx="5.6" cy="6.6" r="1.1" fill="#FF9AB8"/><circle cx="8" cy="5.9" r="1.1" fill="#FF9AB8"/><circle cx="10.3" cy="6.4" r="1" fill="#FF9AB8"/><ellipse cx="16.4" cy="16.4" rx="2.8" ry="3.8" fill="#FFC2D4"/><circle cx="14.3" cy="11.7" r="1" fill="#FFC2D4"/><circle cx="16.5" cy="11.1" r="1" fill="#FFC2D4"/><circle cx="18.5" cy="11.6" r=".9" fill="#FFC2D4"/>'
  },
  tooth: {
    ru: 'зуб зубик',
    svg: '<path d="M6 6.5c0-2 2.6-3 6-3s6 1 6 3c0 3-1.3 4.6-1.8 8-.3 2-1 3.4-2.1 3.4-1.4 0-1.3-3.6-2.1-3.6s-.7 3.6-2.1 3.6c-1.1 0-1.8-1.4-2.1-3.4C7.3 11.1 6 9.5 6 6.5Z" fill="#F2F7FF" stroke="#C3D4E8" stroke-width="1.2"/>'
  },
  mom: {
    ru: 'мама женщина',
    svg: '<path d="M5.5 12a6.5 6.5 0 0 1 13 0v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="#8B4A6B"/><circle cx="12" cy="10.5" r="5" fill="#FFD3B0"/><path d="M6.6 9.5a5.6 5.6 0 0 1 10.8 0c-1.6-1.4-3.1-2.6-5.4-2.6S8.2 8.1 6.6 9.5Z" fill="#8B4A6B"/><circle cx="10.2" cy="10.6" r=".9" fill="#3A2350"/><circle cx="13.8" cy="10.6" r=".9" fill="#3A2350"/><path d="M10.8 13.2a2 2 0 0 0 2.4 0" stroke="#C4736B" stroke-width="1.1" stroke-linecap="round" fill="none"/>'
  },
  dad: {
    ru: 'папа мужчина',
    svg: '<path d="M5.5 20v-2.4a6.5 6.5 0 0 1 13 0V20z" fill="#4A90D9"/><circle cx="12" cy="10" r="5" fill="#FFD3B0"/><path d="M7 8.4a5 5 0 0 1 10 0c-1.4-.9-2.9-1.5-5-1.5s-3.6.6-5 1.5Z" fill="#4A3728"/><circle cx="10.2" cy="10.2" r=".9" fill="#3A2350"/><circle cx="13.8" cy="10.2" r=".9" fill="#3A2350"/><path d="M10.6 12.8a2.2 2.2 0 0 0 2.8 0" stroke="#C4736B" stroke-width="1.1" stroke-linecap="round" fill="none"/>'
  },
  baby: {
    ru: 'малыш ребёнок тимоша',
    svg: '<circle cx="12" cy="12.5" r="7" fill="#FFD3B0"/><path d="M11 5.6c0-1.6 2.6-1.9 2.6-.3 0 1-1.2 1-1.2 1.9" stroke="#C98B4B" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="9.4" cy="11.8" r="1" fill="#3A2350"/><circle cx="14.6" cy="11.8" r="1" fill="#3A2350"/><circle cx="7.6" cy="14.4" r="1.4" fill="#FF9AB8" opacity=".7"/><circle cx="16.4" cy="14.4" r="1.4" fill="#FF9AB8" opacity=".7"/><path d="M10.2 15.2a2.6 2.6 0 0 0 3.6 0" stroke="#C4736B" stroke-width="1.3" stroke-linecap="round" fill="none"/>'
  },
  teddy: {
    ru: 'мишка игрушка мягкая',
    svg: '<circle cx="6.6" cy="6.6" r="2.8" fill="#B07A4E"/><circle cx="17.4" cy="6.6" r="2.8" fill="#B07A4E"/><circle cx="12" cy="12" r="8" fill="#C98B4B"/><circle cx="9.2" cy="10.4" r="1.1" fill="#3A2350"/><circle cx="14.8" cy="10.4" r="1.1" fill="#3A2350"/><ellipse cx="12" cy="14.4" rx="4" ry="3.2" fill="#E8CBA8"/><ellipse cx="12" cy="13" rx="1.5" ry="1.1" fill="#3A2350"/><path d="M12 14.1v1.4M12 15.5c-.9.9-2 .3-2-.6M12 15.5c.9.9 2 .3 2-.6" stroke="#3A2350" stroke-width="1" stroke-linecap="round" fill="none"/>'
  },
  phone: {
    ru: 'телефон смартфон',
    svg: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6" fill="#3A3F52"/><rect x="8" y="5" width="8" height="12.5" rx="1" fill="#7FD6D2"/><circle cx="12" cy="19.4" r="1.1" fill="#8B93A8"/><path d="M10.6 3.8h2.8" stroke="#8B93A8" stroke-width="1.1" stroke-linecap="round"/>'
  },
  banana: {
    ru: 'банан фрукт',
    svg: '<path d="M4.5 10.5c0 6 4.6 9.5 9.5 9.5 3.4 0 5.5-1.6 5.5-3 0-.9-.8-1.3-1.6-1-1 .4-2 .6-3.1.6-4.2 0-7.6-3.2-7.6-7.5 0-.9-.7-1.4-1.4-1.4s-1.3.5-1.3 1.4Z" fill="#FFD84D"/><path d="M4.4 9.6 3.6 6.4a1 1 0 0 1 1.9-.5l.7 3" fill="#8FA25B"/><path d="M18.4 17.6c.9-.2 1.6.3 1.6 1.2" stroke="#C9A22A" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
  },
  cookie: {
    ru: 'печенье',
    svg: '<circle cx="12" cy="12" r="8.5" fill="#D9A05B"/><circle cx="9.4" cy="9.6" r="1.4" fill="#6B4423"/><circle cx="15" cy="10.6" r="1.2" fill="#6B4423"/><circle cx="11" cy="15" r="1.3" fill="#6B4423"/><circle cx="15.6" cy="15.2" r="1" fill="#6B4423"/><circle cx="7.6" cy="13.6" r=".9" fill="#6B4423"/>'
  },
  speaker: {
    ru: 'колонка алиса умная',
    svg: '<path d="M6 8.5a6 3 0 0 1 12 0V17a6 3 0 0 1-12 0z" fill="#5B6470"/><ellipse cx="12" cy="8.5" rx="6" ry="3" fill="#7C8794"/><ellipse cx="12" cy="8.5" rx="3.6" ry="1.7" fill="#7FD6D2"/><path d="M6.4 15.4a6 3 0 0 0 11.2 0" stroke="#9B6BFF" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
  },
  walking: {
    ru: 'ходить шаги ножками стоя',
    svg: '<circle cx="12.6" cy="4.6" r="2.6" fill="#FFD3B0"/><path d="M12.6 7.6c-2 0-3.2 1.2-3.4 3l-.4 3.2 1.9.4.5-2.6.4 3.6-2.4 5.2 1.9.9 2.6-5.2 1.8 5.3 2-.7-1.7-5.6.1-3.6 1.6 2.3 1.7-1.1-2.3-3.4c-.7-1-1.6-1.7-3-1.7Z" fill="#FF8A3D"/>'
  },
  crawling: {
    ru: 'ползать на четвереньках',
    svg: '<circle cx="17.5" cy="8" r="3.6" fill="#FFD3B0"/><path d="M5.5 13.5a2.2 2.2 0 0 1 2.2-2.2h6.6a2.2 2.2 0 0 1 2.2 2.2v1.8a2.2 2.2 0 0 1-2.2 2.2H7.7a2.2 2.2 0 0 1-2.2-2.2z" fill="#FF8A3D"/><path d="M7.4 16.6v3.6M14.6 16.6v3.6" stroke="#FF8A3D" stroke-width="2.8" stroke-linecap="round"/><path d="M5.6 20.4h3.4M13 20.4h3.4" stroke="#E8732A" stroke-width="2.4" stroke-linecap="round"/><path d="M17.2 11.4a2 2 0 0 1 2 2v6.8" stroke="#FFD3B0" stroke-width="2.8" stroke-linecap="round" fill="none"/>'
  },
  car: {
    ru: 'машинка машина',
    svg: '<path d="M3 15.5v-2.2c0-.6.3-1.1.8-1.4l2-1.1 2-3a2 2 0 0 1 1.7-.9h5a2 2 0 0 1 1.7.9l2 3 2 1.1c.5.3.8.8.8 1.4v2.2z" fill="#E63946"/><rect x="8.5" y="8.4" width="3" height="3.2" rx=".6" fill="#BFE7F5"/><rect x="12.5" y="8.4" width="3.4" height="3.2" rx=".6" fill="#BFE7F5"/><circle cx="7" cy="16.4" r="2.6" fill="#3A3F52"/><circle cx="17" cy="16.4" r="2.6" fill="#3A3F52"/><circle cx="7" cy="16.4" r="1" fill="#C3D4E8"/><circle cx="17" cy="16.4" r="1" fill="#C3D4E8"/>'
  },
  doll: {
    ru: 'кукла игрушка',
    svg: '<path d="M12 12.5c3.4 0 5.5 3.2 5.5 7.5h-11c0-4.3 2.1-7.5 5.5-7.5Z" fill="#FF7BAC"/><circle cx="12" cy="8" r="5" fill="#FFD3B0"/><path d="M7.2 6.6a5 5 0 0 1 9.6 0c-1.2-.6-1.6 2.4-1.6 2.4S15 6.4 12 6.4 8.8 9 8.8 9s-.4-3-1.6-2.4Z" fill="#FFC93C"/><circle cx="10.2" cy="8.2" r=".9" fill="#3A2350"/><circle cx="13.8" cy="8.2" r=".9" fill="#3A2350"/><circle cx="8.6" cy="9.8" r="1" fill="#FF9AB8"/><circle cx="15.4" cy="9.8" r="1" fill="#FF9AB8"/>'
  },
  bowl: {
    ru: 'пюре каша тарелка еда',
    svg: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z" fill="#7FD6D2"/><path d="M6 11.5c0-2.4 2.7-4 6-4s6 1.6 6 4z" fill="#F3D9A8"/><path d="M9.5 7c0-1 1-1.2 1-2.2M13 6.6c0-1 1-1.4 1-2.4" stroke="#C3D4E8" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="M2.5 11.5h19" stroke="#4FB3AE" stroke-width="1.6" stroke-linecap="round"/>'
  },
  carrot: {
    ru: 'морковка овощ',
    svg: '<path d="M9.4 9.4 6 20.6a1 1 0 0 0 1.4 1.2l10.4-5.6z" fill="#FF8A3D"/><path d="m8.4 12.6 2.4 2.2M10.4 16.6l2-1.8" stroke="#D96A22" stroke-width="1.2" stroke-linecap="round"/><path d="M10 8.4 8.6 5.2a1 1 0 0 1 1.6-1.1l2 2.2 2.6-2a1 1 0 0 1 1.5 1.3l-1.6 2.8 3-.2a1 1 0 0 1 .4 2z" fill="#5FBF5F"/>'
  },
  cake: {
    ru: 'торт праздник',
    svg: '<path d="M4 20v-6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V20z" fill="#FFB3C6"/><path d="M4 16.5h16V20H4z" fill="#FF7BAC"/><rect x="11.2" y="6.5" width="1.6" height="4.4" rx=".6" fill="#7FD6D2"/><path d="M12 3.4c1.4 1.4 1.4 3.1 0 3.1s-1.4-1.7 0-3.1Z" fill="#FFC93C"/>'
  },
  balloon: {
    ru: 'шарик воздушный',
    svg: '<path d="M12 2.5c3 0 5.4 2.7 5.4 6.1S15 15.4 12 15.4 6.6 12 6.6 8.6 9 2.5 12 2.5Z" fill="#E63946"/><path d="M9.4 6.2c.4-1.3 1.3-2.1 2.3-2.4" stroke="#FFB9BE" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="m12 15.4 1.1 1.7h-2.2z" fill="#B02B36"/><path d="M12 17.1c0 2.4-2.2 2-2.2 4.4" stroke="#8FA0B8" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
  },
  ball: {
    ru: 'мяч играть',
    svg: '<circle cx="12" cy="12" r="8.5" fill="#FFF"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#C3D4E8" stroke-width="1.2"/><path d="M12 6.2 15.6 9l-1.4 4.4h-4.4L8.4 9z" fill="#3A3F52"/><path d="M12 3.5v2.7M20 9.4l-4.4-.4M17 19l-2.8-5.6M7 19l2.8-5.6M4 9.4l4.4-.4" stroke="#3A3F52" stroke-width="1.3"/>'
  },
  book: {
    ru: 'книжка сказка читать',
    svg: '<path d="M3.5 5.5c2.6-1.4 5.6-1.4 8.5.6v13c-2.9-2-5.9-2-8.5-.6z" fill="#7FD6D2"/><path d="M20.5 5.5c-2.6-1.4-5.6-1.4-8.5.6v13c2.9-2 5.9-2 8.5-.6z" fill="#4A90D9"/><path d="M12 6.1v13" stroke="#2F6DA8" stroke-width="1.2"/>'
  },
  cat: {
    ru: 'кошка кот',
    svg: '<path d="m6 8 .4-3.6L9.4 6.6zM18 8l-.4-3.6L14.6 6.6z" fill="#8FA0B8"/><circle cx="12" cy="12.6" r="7" fill="#A9B7C7"/><ellipse cx="9.3" cy="11.6" rx="1" ry="1.4" fill="#3A2350"/><ellipse cx="14.7" cy="11.6" rx="1" ry="1.4" fill="#3A2350"/><path d="M12 14.4 10.8 13.3h2.4z" fill="#FF9AB8"/><path d="M12 14.4v1M12 15.4c-.8.9-2 .4-2-.5M12 15.4c.8.9 2 .4 2-.5" stroke="#3A2350" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M4.6 13.4 7.6 14M4.8 16.2l2.9-1M19.4 13.4 16.4 14M19.2 16.2l-2.9-1" stroke="#5C6B7C" stroke-width=".9" stroke-linecap="round"/>'
  },
  dog: {
    ru: 'собака пёс',
    svg: '<ellipse cx="5.6" cy="10.6" rx="2.4" ry="4" fill="#8A5A34"/><ellipse cx="18.4" cy="10.6" rx="2.4" ry="4" fill="#8A5A34"/><circle cx="12" cy="12.4" r="7" fill="#B07A4E"/><circle cx="9.4" cy="11" r="1.1" fill="#3A2350"/><circle cx="14.6" cy="11" r="1.1" fill="#3A2350"/><ellipse cx="12" cy="15.2" rx="4" ry="3.2" fill="#E8CBA8"/><ellipse cx="12" cy="13.8" rx="1.7" ry="1.2" fill="#3A2350"/><path d="M12 15v1.4M10.6 18.2c1 .8 2.8.4 2.8-1.4" stroke="#3A2350" stroke-width="1" fill="none" stroke-linecap="round"/>'
  },
  house: {
    ru: 'дом домик',
    svg: '<path d="M2.5 11.5 12 3.5l9.5 8z" fill="#E63946"/><path d="M5 11v9.5h14V11z" fill="#F3D9A8"/><rect x="10" y="14.5" width="4" height="6" rx=".6" fill="#8A5A34"/><rect x="6.4" y="13" width="2.6" height="2.6" rx=".5" fill="#7FD6D2"/><rect x="15" y="13" width="2.6" height="2.6" rx=".5" fill="#7FD6D2"/>'
  },
  tree: {
    ru: 'дерево улица гулять',
    svg: '<rect x="10.8" y="13" width="2.4" height="7.5" rx=".8" fill="#8A5A34"/><circle cx="12" cy="8.5" r="5.5" fill="#5FBF5F"/><circle cx="8" cy="11" r="3.4" fill="#4FA84F"/><circle cx="16" cy="11" r="3.4" fill="#6FCF6F"/>'
  },
  water: {
    ru: 'вода бутылочка пить',
    svg: '<path d="M9 6.5h6v12.4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" fill="#BFE7F5"/><path d="M9 12h6v6.9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" fill="#4FB3E8"/><rect x="9.6" y="3" width="4.8" height="3.6" rx="1" fill="#7FD6D2"/>'
  },
  apple: {
    ru: 'яблоко фрукт',
    svg: '<path d="M12 7.5c3.4-2 8 .4 8 5.1 0 4-2.6 8.4-4.8 8.4-1.2 0-1.8-.7-3.2-.7s-2 .7-3.2.7C6.6 21 4 16.6 4 12.6 4 7.9 8.6 5.5 12 7.5Z" fill="#E63946"/><path d="M12 7.5V5" stroke="#8A5A34" stroke-width="1.6" stroke-linecap="round"/><path d="M12.4 5.4c1-2 3-2.2 3.6-2-.2 1.6-1.6 2.8-3.6 2.8Z" fill="#5FBF5F"/>'
  },
  star: {
    ru: 'звезда балл',
    svg: '<path d="m12 2.8 2.9 5.9 6.5 1-4.7 4.5 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.5 6.5-1z" fill="#FFC93C"/>'
  },
  heart: {
    ru: 'сердце любовь',
    svg: '<path d="M12 20.5S3 14.9 3 9.4a4.6 4.6 0 0 1 9-1.6 4.6 4.6 0 0 1 9 1.6c0 5.5-9 11.1-9 11.1Z" fill="#FF5C8A"/>'
  },
  note: {
    ru: 'нотка песенка музыка',
    svg: '<path d="M9.5 17.5V5.8l9-1.8v10" fill="none" stroke="#9B6BFF" stroke-width="2.2" stroke-linecap="round"/><circle cx="7" cy="18" r="2.8" fill="#9B6BFF"/><circle cx="16" cy="16" r="2.8" fill="#9B6BFF"/>'
  },
  cup: {
    ru: 'кружка чашка',
    svg: '<path d="M4.5 7h12v8.5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="#7FD6D2"/><path d="M16.5 9.5h1.8a2.6 2.6 0 0 1 0 5.2h-1.8" fill="none" stroke="#4FB3AE" stroke-width="1.8"/><path d="M4.5 7h12v2.6h-12z" fill="#FFF" opacity=".55"/>'
  },
  spoon: {
    ru: 'ложка кормить',
    svg: '<ellipse cx="12" cy="6.8" rx="4.4" ry="3.6" fill="#C3D4E8"/><ellipse cx="12" cy="6.8" rx="2.8" ry="2.2" fill="#8FA0B8"/><path d="M10.6 10v9.6a1.4 1.4 0 0 0 2.8 0V10z" fill="#C3D4E8"/>'
  },
  sock: {
    ru: 'носочек одежда',
    svg: '<path d="M7 3.5h5.5v8.2l4 4a3.6 3.6 0 0 1-5.1 5.1L7 15.4z" fill="#FF7BAC"/><path d="M7 3.5h5.5v2.8H7z" fill="#9B6BFF"/>'
  },
  pacifier: {
    ru: 'соска пустышка',
    svg: '<circle cx="12" cy="14.5" r="6" fill="none" stroke="#FF9AB8" stroke-width="2.6"/><circle cx="12" cy="14.5" r="3.4" fill="#BFE7F5"/><path d="M9.4 8.6c0-2.4 5.2-2.4 5.2 0 0 1.6-1 2.4-2.6 2.4s-2.6-.8-2.6-2.4Z" fill="#FFC93C"/>'
  },
  both: {
    ru: 'пополам поровну оба сразу',
    svg: '<path d="M12 2.5a9.5 9.5 0 0 1 0 19z" fill="#4A90D9"/><path d="M12 2.5a9.5 9.5 0 0 0 0 19z" fill="#FF7BAC"/><path d="M12 2.5v19" stroke="#fff" stroke-width="1.6"/>'
  },
  tv: {
    ru: 'мультик телевизор',
    svg: '<rect x="2.5" y="6.5" width="19" height="12" rx="2" fill="#3A3F52"/><rect x="4.5" y="8.5" width="15" height="8" rx="1" fill="#7FD6D2"/><path d="m8 3 4 3.5M16 3l-4 3.5" stroke="#8FA0B8" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12.5" r="2.2" fill="#FFC93C"/>'
  },
  sleep: {
    ru: 'спать сон кроватка',
    svg: '<path d="M2.5 18v-7a1 1 0 0 1 1-1h1.5v4h14V18z" fill="#8A5A34"/><path d="M2.5 15.5h19V18h-19z" fill="#B07A4E"/><rect x="5" y="10.5" width="14" height="3.6" rx="1.4" fill="#BFE7F5"/><circle cx="8" cy="9" r="2" fill="#FFD3B0"/><path d="M14 7.5h3l-3 3h3" stroke="#9B6BFF" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  hand: {
    ru: 'рука ладошка',
    svg: '<path d="M7 13V5.4a1.5 1.5 0 0 1 3 0V11m0-1.4V4.2a1.5 1.5 0 0 1 3 0V11m0-1.6V5.4a1.5 1.5 0 0 1 3 0V13m0-2.4a1.5 1.5 0 0 1 3 0v5.2a5.5 5.5 0 0 1-5.5 5.5H12A5 5 0 0 1 7 16.3z" fill="#FFD3B0" stroke="#E0A87F" stroke-width="1"/>'
  }
};

// Эмоции и праздничный реквизит — те же цветные SVG, без зависимости от шрифта эмодзи.
const face = (details) => `<circle cx="12" cy="12" r="10" fill="#FFD45C"/><path d="M6 5q4-3 8-2" stroke="#FFF1B5" stroke-width="1.5" stroke-linecap="round" fill="none"/>${details}`;
const eyes = '<circle cx="8" cy="9" r="1.4" fill="#3A2350"/><circle cx="16" cy="9" r="1.4" fill="#3A2350"/>';
const grin = '<path d="M6 13h12c-1 8-11 8-12 0Z" fill="#773B45"/><path d="M7 13h10v2H7Z" fill="white"/>';
Object.assign(A, {
  smile: { ru: 'Улыбка радость', svg: face(eyes+'<path d="M7 14q5 6 10 0" stroke="#3A2350" stroke-width="1.8" fill="none" stroke-linecap="round"/>') },
  laugh: { ru: 'Смех веселье', svg: face('<path d="m5 10 3-2 3 2m2 0 3-2 3 2" stroke="#3A2350" stroke-width="1.5" fill="none"/>'+grin) },
  wink: { ru: 'Подмигивание хитрость', svg: face('<circle cx="8" cy="9" r="1.4" fill="#3A2350"/><path d="m14 10 2-2 2 2M7 14q5 6 10 0" stroke="#3A2350" stroke-width="1.6" fill="none" stroke-linecap="round"/>') },
  wow: { ru: 'Удивление вау', svg: face(eyes+'<ellipse cx="12" cy="16" rx="2.5" ry="3" fill="#3A2350"/>') },
  sad: { ru: 'Грусть печаль', svg: face(eyes+'<path d="M7 17q5-6 10 0" stroke="#3A2350" stroke-width="1.7" fill="none" stroke-linecap="round"/>') },
  cry: { ru: 'Слёзы плач', svg: face(eyes+'<path d="M7 17q5-6 10 0" stroke="#3A2350" stroke-width="1.5" fill="none"/><path d="M18 11q-5 6 0 6t0-6Z" fill="#4A90D9"/>') },
  cool: { ru: 'Круто очки', svg: face('<path d="M3 7h18v2h-1l-1 4h-5l-1-3h-2l-1 3H5L4 9H3Z" fill="#3A2350"/><path d="M9 17q4 3 7-1" stroke="#3A2350" stroke-width="1.6" fill="none" stroke-linecap="round"/>') },
  love: { ru: 'Влюблённость сердечки', svg: face('<path d="M8 12 4 8c-2-4 3-5 4-2 2-3 6-1 4 2Zm9 0-4-4c-2-4 3-5 4-2 2-3 6-1 4 2Z" fill="#E63946"/><path d="M8 15q4 5 8 0" stroke="#773B45" stroke-width="1.6" fill="none"/>') },
  sleepy: { ru: 'Сонный зевота', svg: face('<path d="M5 10q3 3 6 0m2 0q3 3 6 0" stroke="#3A2350" stroke-width="1.5" fill="none"/><ellipse cx="12" cy="16" rx="2" ry="2.5" fill="#3A2350"/>') },
  tongue: { ru: 'Дразнилка язык', svg: face(eyes+'<path d="M6 13q6 9 12 0Z" fill="#3A2350"/><path d="M11 15h5v4a2.5 2.5 0 0 1-5 0Z" fill="#F679A0"/>') },
  thinking: { ru: 'Раздумье думаю', svg: face(eyes+'<path d="m6 5 4 1m4-1 4-1M9 16h5" stroke="#3A2350" stroke-width="1.5" stroke-linecap="round"/><path d="m15 21-1-5 3-2 2 1-2 2 2 4Z" fill="#EDA945"/>') },
  party: { ru: 'Праздничный смайлик', svg: face(eyes+grin+'<path d="m2 8 3-8 7 5Z" fill="#9B6BFF"/><circle cx="5" cy="3" r="1" fill="#FFC93C"/><path d="m17 15 6 2-1 3-6-3Z" fill="#22C1BC"/>') },
  gift: { ru: 'Подарок сюрприз', svg: '<rect x="4" y="10" width="16" height="11" rx="2" fill="#E63946"/><rect x="2" y="7" width="20" height="5" rx="1" fill="#FF7BAC"/><path d="M10 7h4v14h-4Z" fill="#FFC93C"/><path d="M12 7C1 7 6-3 12 7c6-10 11 0 0 0Z" stroke="#D9A00F" stroke-width="2" fill="none"/>' },
  icecream: { ru: 'Мороженое сладкое', svg: '<path d="m6 10 6 13 6-13Z" fill="#DCA663"/><path d="m8 12 6 6m-4-3 5-3" stroke="#B78249" stroke-width="1.2"/><path d="M5 10c-3-4 1-6 3-6 0-5 8-5 8 0 3-1 7 4 3 7Z" fill="#FF9CC3"/>' },
  watermelon: { ru: 'Арбуз ягода', svg: '<path d="M1 7h22C21 25 3 25 1 7Z" fill="#5FBF5F"/><path d="M3 7h18C19 22 5 22 3 7Z" fill="#FFF0CE"/><path d="M5 7h14C17 19 7 19 5 7Z" fill="#F26070"/><path d="m8 10 1 2m6-2-1 2m-2 2v1" stroke="#3A2350" stroke-width="1.3" stroke-linecap="round"/>' },
  pizza: { ru: 'Пицца еда', svg: '<path d="m3 4 18 1-10 17Z" fill="#FFCE68"/><path d="m3 4 18 1" stroke="#CC8E4B" stroke-width="4" stroke-linecap="round"/><circle cx="9" cy="9" r="2" fill="#E63946"/><circle cx="14" cy="12" r="2" fill="#E63946"/>' },
  train: { ru: 'Поезд паровоз', svg: '<path d="M3 9h10v9H3Zm10-6h7v15h-7Z" fill="#22C1BC"/><path d="M5 4h4v5H5Z" fill="#E63946"/><rect x="15" y="5" width="3" height="5" rx=".5" fill="#BFE7F5"/><circle cx="6" cy="19" r="3" fill="#3A2350"/><circle cx="17" cy="19" r="3" fill="#3A2350"/><path d="M3 2h4" stroke="#AAB8C9" stroke-width="2" stroke-linecap="round"/>' },
  rocket: { ru: 'Ракета космос', svg: '<path d="m8 17 4 7 4-7" fill="#FF8A3D"/><path d="m7 11-5 8 6-1m9-7 5 8-6-1" fill="#E63946"/><path d="M12 1C6 6 6 14 8 18h8c2-4 2-12-4-17Z" fill="#DCE8F2"/><circle cx="12" cy="9" r="3" fill="#4A90D9"/>' },
  butterfly: { ru: 'Бабочка насекомое', svg: '<path d="M11 10C1-4-3 14 9 13-1 18 8 26 11 16m2-6C23-4 27 14 15 13c10 5 1 13-2 3" fill="#B28AEE"/><path d="M12 8v11m0-11-3-4m3 4 3-4" stroke="#3A2350" stroke-width="1.8" stroke-linecap="round"/><circle cx="6" cy="9" r="2" fill="#FFC93C"/><circle cx="18" cy="9" r="2" fill="#FFC93C"/>' },
  flower: { ru: 'Цветок букет', svg: '<path d="M12 12v11m0-3q-8 0-7-6 7 0 7 6" fill="#5FBF5F" stroke="#5FBF5F" stroke-width="2"/><g fill="#FF7BAC"><circle cx="12" cy="4" r="4"/><circle cx="6" cy="8" r="4"/><circle cx="18" cy="8" r="4"/><circle cx="8" cy="14" r="4"/><circle cx="16" cy="14" r="4"/></g><circle cx="12" cy="9" r="4" fill="#FFC93C"/>' },
  drum: { ru: 'Барабан цирк', svg: '<path d="M3 9h18v11c-4 3-14 3-18 0Z" fill="#E63946"/><path d="m4 12 4 8 4-8 4 8 4-8" stroke="#FFC93C" stroke-width="2" fill="none"/><ellipse cx="12" cy="9" rx="9" ry="3" fill="#FFEBC9"/><path d="m5 2 11 5m3-5L8 7" stroke="#8A5A34" stroke-width="2" stroke-linecap="round"/>' },
  magic: { ru: 'Фокус шляпа волшебство', svg: '<path d="m6 8 2 11h8l2-11Z" fill="#523771"/><ellipse cx="12" cy="8" rx="6" ry="2" fill="#3A2350"/><path d="M8 15h8v3H8Z" fill="#E63946"/><ellipse cx="12" cy="20" rx="10" ry="2" fill="#674B89"/><path d="m19 1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#FFC93C"/><path d="m8 6-2-4m6 3 1-4" stroke="#22C1BC" stroke-width="2" stroke-linecap="round"/>' },
  crown: { ru: 'Корона победитель', svg: '<path d="m3 6 5 5 4-8 4 8 5-5-2 14H5Z" fill="#FFC93C"/><path d="M5 17h14" stroke="#D9A00F" stroke-width="2"/><circle cx="12" cy="13" r="2" fill="#E63946"/>' },
  rainbow: { ru: 'Радуга погода', svg: '<path d="M3 19v-5a9 9 0 0 1 18 0v5" stroke="#E63946" stroke-width="3"/><path d="M6 19v-5a6 6 0 0 1 12 0v5" stroke="#FFC93C" stroke-width="3"/><path d="M9 19v-5a3 3 0 0 1 6 0v5" stroke="#22C1BC" stroke-width="3"/>' }
});

// Цифры 1–7 — для вопросов вроде «в какой день недели».
const NUM_COLORS = ['#E63946', '#FF8A3D', '#FFC93C', '#5FBF5F', '#22C1BC', '#4A90D9', '#9B6BFF'];
for (let n = 1; n <= 7; n++) {
  A['num-' + n] = {
    ru: 'цифра ' + n,
    svg: `<circle cx="12" cy="12" r="9.5" fill="${NUM_COLORS[n - 1]}"/>` +
      `<text x="12" y="12" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="Nunito, sans-serif" font-size="13" font-weight="900" fill="#fff">${n}</text>`
  };
}

export const ART_NAMES = Object.keys(A);
export const ART_LABELS = ART_NAMES.reduce((acc, k) => { acc[k] = A[k].ru; return acc; }, {});

export function artSprite() {
  return '<svg class="art-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' +
    ART_NAMES.map((n) => `<symbol id="a-${n}" viewBox="0 0 24 24">${A[n].svg}</symbol>`).join('') +
    '</svg>';
}

export function art(name, cls) {
  if (!A[name]) return '';
  return `<svg class="art ${cls || ''}" aria-hidden="true"><use href="#a-${name}"/></svg>`;
}

export function hasArt(name) {
  return !!A[name];
}

export function mountArtSprite() {
  if (document.querySelector('.art-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', artSprite());
}
