'use client';

import { useEffect, useState } from 'react';

export default function AffiliateLink() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    setIsMobile(mobileRegex.test(userAgent));
  }, []);

  if (isMobile) {
    // モバイル用のアフィリエイトリンク
    return (
      <div className="flex justify-center mb-4 mt-6">
        <div
          dangerouslySetInnerHTML={{
            __html: `<a href="//af.moshimo.com/af/c/click?a_id=5325564&p_id=55&pc_id=55&pl_id=629" rel="nofollow" referrerpolicy="no-referrer-when-downgrade" attributionsrc><img src="//image.moshimo.com/af-img/0032/000000000629.gif" width="300" height="250" style="border:none;"></a><img src="//i.moshimo.com/af/i/impression?a_id=5325564&p_id=55&pc_id=55&pl_id=629" width="1" height="1" style="border:none;" loading="lazy"></img>`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      {/* START MoshimoAffiliateEasyLink */}
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `(function(b,c,f,g,a,d,e){b.MoshimoAffiliateObject=a;\n b[a]=b[a]||function(){arguments.currentScript=c.currentScript\n||c.scripts[c.scripts.length-2];(b[a].q=b[a].q||[]).push(arguments)};\n c.getElementById(a)||(d=c.createElement(f),d.src=g,\n d.id=a,e=c.getElementsByTagName("body")[0],e.appendChild(d))})(window,document,"script","//dn.msmstatic.com/site/cardlink/bundle.js?20220329","msmaflink");\n msmaflink({"n":"【12月27日から 最大3％OFFクーポン】 ケンコー KENKO テニス ソフトテニスボールスタンダード イエロー 1ダース 12球 練習球 バルブエア式 天然ゴム 練習 部活 クラブ チーム 新入部員 合宿 TSSYV","b":"","t":"","d":"https:\\/\\/thumbnail.image.rakuten.co.jp","c_p":"","p":["\\/@0_mall\\/spg-sports\\/cabinet\\/images608\\/ken-tssyv_1.jpg"],"u":{"u":"https:\\/\\/item.rakuten.co.jp\\/spg-sports\\/ken-tssyv\\/","t":"rakuten","r_v":""},"v":"2.1","b_l":[{"id":1,"u_tx":"楽天市場で見る","u_bc":"#f76956","u_url":"https:\\/\\/item.rakuten.co.jp\\/spg-sports\\/ken-tssyv\\/","a_id":5314178,"p_id":54,"pl_id":27059,"pc_id":54,"s_n":"rakuten","u_so":1}],"eid":"MKMyt","s":"l"});`,
        }}
      />
      <div id="msmaflink-MKMyt" className="mb-4 mt-6">
        リンク
      </div>
      {/* MoshimoAffiliateEasyLink END */}
    </div>
  );
}
