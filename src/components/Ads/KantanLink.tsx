import { useEffect } from 'react';

export const KantanLink = () => {
  useEffect(() => {
    // Moshimo Affiliate Script Helper
    // eslint-disable-next-line
        (function (b: any, c: any, f: any, g: any, a: any, d?: any, e?: any) {
      b.MoshimoAffiliateObject = a;
      b[a] =
        b[a] ||
        function () {
          // eslint-disable-next-line
                    (arguments as any).currentScript =
            c.currentScript || c.scripts[c.scripts.length - 2];
          // eslint-disable-next-line
                    (b[a].q = b[a].q || []).push(arguments);
        };
      if (!c.getElementById(a)) {
        d = c.createElement(f);
        d.src = g;
        d.id = a;
        e = c.getElementsByTagName('body')[0];
        e.appendChild(d);
      }
    })(
      window,
      document,
      'script',
      '//dn.msmstatic.com/site/cardlink/bundle.js?20220329',
      'msmaflink',
    );

    // Call the function with the data
    // eslint-disable-next-line
        (window as any).msmaflink({
      n: '【10%OFFクーポン対象】【ネーム入れ】ケンコー 公認球 ソフトテニスボールかご入りセット 10ダース（ソフトテニスボール） 軟式テニスボール',
      b: '',
      t: '',
      d: 'https://thumbnail.image.rakuten.co.jp',
      c_p: '/@0_mall/kpi/cabinet/item3',
      p: ['/tsowk-v.jpg', '/tsoyk-v.jpg', '/kenko-name-image.jpg'],
      u: {
        u: 'https://item.rakuten.co.jp/kpi/tso-name/',
        t: 'rakuten',
        r_v: '',
      },
      v: '2.1',
      b_l: [
        {
          id: 1,
          u_tx: '楽天市場で見る',
          u_bc: '#f76956',
          u_url: 'https://item.rakuten.co.jp/kpi/tso-name/',
          a_id: 5314178,
          p_id: 54,
          pl_id: 27059,
          pc_id: 54,
          s_n: 'rakuten',
          u_so: 0,
        },
      ],
      eid: '0ltql',
      s: 'l',
    });
  }, []);

  return (
    <div className="my-8 flex justify-center">
      <div id="msmaflink-0ltql"></div>
    </div>
  );
};
