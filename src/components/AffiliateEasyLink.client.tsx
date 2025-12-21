import { useEffect } from 'react';

export default function AffiliateEasyLink() {
  useEffect(() => {
    const id = 'msmaflink';
    const createAndRun = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).msmaflink({
          n: '【12/26 2時まで ポイント最大15倍！】 ルーセント LUCENT テニス ソフトテニスボール アカエム 試合球 ホワイト 1ダース 12球 軟式テニス 軟式球 中学 高校 テニボ 部活 練習 軟式テニス用品 箱販売 ソフトテニス M30000',
          b: '',
          t: '',
          d: 'https://thumbnail.image.rakuten.co.jp',
          c_p: '',
          p: ['/@0_mall/sportsaomori/cabinet/images607/sg-m30000_1.jpg'],
          u: {
            u: 'https://item.rakuten.co.jp/sportsaomori/sg-m30000/',
            t: 'rakuten',
            r_v: '',
          },
          v: '2.1',
          b_l: [
            {
              id: 1,
              u_tx: '楽天市場で見る',
              u_bc: '#f76956',
              u_url: 'https://item.rakuten.co.jp/sportsaomori/sg-m30000/',
              a_id: 5314178,
              p_id: 54,
              pl_id: 27059,
              pc_id: 54,
              s_n: 'rakuten',
              u_so: 1,
            },
          ],
          eid: 'pt6jl',
          s: 'xs',
        });
      } catch {
        // ignore
      }
    };

    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = '//dn.msmstatic.com/site/cardlink/bundle.js?20220329';
      s.async = true;
      s.onload = () => {
        createAndRun();
      };
      document.body.appendChild(s);
    } else {
      createAndRun();
    }

    // create placeholder div expected by the script
    if (!document.getElementById('msmaflink-pt6jl')) {
      const d = document.createElement('div');
      d.id = 'msmaflink-pt6jl';
      d.textContent = 'リンク';
      d.style.marginBottom = '1rem';
      const parent = document.querySelector('.max-w-3xl');
      if (parent)
        parent.insertBefore(d, parent.querySelector('.mt-12') || null);
    }
  }, []);

  return null;
}
