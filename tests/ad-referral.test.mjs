import test from 'node:test';
import assert from 'node:assert/strict';
import { adReferralView } from '../app/lib/ad-referral.ts';

test('arma la tarjeta del anuncio con plataforma, imagen y enlace', () => {
  const view = adReferralView({ sourceUrl: 'https://fb.me/abc', sourceId: '120', sourceType: 'ad', headline: ' Calcetines al mayoreo ', body: 'Desde 12 pares', mediaType: 'video', thumbnailUrl: 'https://scontent/x.jpg' });
  assert.deepEqual(view, { title: 'Mensaje desde un anuncio de Facebook', headline: 'Calcetines al mayoreo', body: 'Desde 12 pares', image: 'https://scontent/x.jpg', isVideo: true, link: 'https://fb.me/abc', adId: '120' });
  assert.equal(adReferralView({ sourceType: 'post', sourceUrl: 'https://www.instagram.com/p/1' }).title, 'Mensaje desde una publicación de Instagram');
  assert.equal(adReferralView(null), null);
  assert.equal(adReferralView({ ctwaClid: 'x' }), null);
});
