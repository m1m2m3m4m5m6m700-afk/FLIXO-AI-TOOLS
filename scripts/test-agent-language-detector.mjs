import assert from 'node:assert/strict';
import { detectAgentLocale } from '../src/lib/agent/language-detector.ts';

assert.equal(detectAgentLocale('اضغط الصورة وحولها إلى WebP', 'en'), 'ar');
assert.equal(detectAgentLocale('Compress the image and convert it to WebP', 'ar'), 'en');
assert.equal(detectAgentLocale('Comprimir la imagen y convertirla a WebP', 'en'), 'es');
assert.equal(detectAgentLocale('Compresser l’image et convertir en WebP', 'en'), 'fr');
assert.equal(detectAgentLocale('Bild komprimieren und in WebP umwandeln', 'en'), 'de');
assert.equal(detectAgentLocale('画像を圧縮してWebPに変換', 'en'), 'ja');
assert.equal(detectAgentLocale('이미지를 압축하고 변환', 'en'), 'ko');
assert.equal(detectAgentLocale('Сжать изображение и выполнить', 'en'), 'ru');
assert.equal(detectAgentLocale('Стиснути зображення та виконати', 'en'), 'uk');
assert.equal(detectAgentLocale('', 'ar'), 'ar');
assert.equal(detectAgentLocale('please make this ready', 'fr'), 'fr');

console.log('agent language detector: PASS');
