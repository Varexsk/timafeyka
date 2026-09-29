// Мелочи, общие для нескольких экранов показа.

import { esc } from '../util.js';
import { avatar, hasAvatar, isPhotoAvatar, photoAvatar } from '../avatars.js';

// Аватар семьи или гостя. Это может быть нарисованный зверь, своя фотография
// из «Медиа» или — у старых данных — эмодзи.
export function avatarHtml(guest, cls) {
  const inner = isPhotoAvatar(guest.avatar)
    ? photoAvatar(guest.avatar)
    : hasAvatar(guest.avatar)
      ? avatar(guest.avatar)
      : `<span style="display:grid;place-items:center;width:100%;height:100%;font-size:1.6em">${esc(guest.emoji || '')}</span>`;
  return `<div class="avatar ${cls || ''}" style="--c:${esc(guest.color || 'var(--ink)')}">${inner}</div>`;
}

// От большего числа звёздочек к меньшему — так строятся и таблица, и подиум, и диплом.
export function sorted(list) {
  return list.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
}
