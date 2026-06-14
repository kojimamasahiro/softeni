import Head from 'next/head';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

export default function STLeagueAbout() {
  const pageTitle = 'STリーグとは | ソフトテニス情報';
  const pageUrl = 'https://softeni-pick.com/st-league/about/';

  return (
    <>
      <MetaHead
        title={pageTitle}
        description="ソフトテニス実業団最高峰リーグ「STリーグ」の概要、仕組み、観戦の見どころについて解説します。"
        url={pageUrl}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: 'STリーグとは',
              description:
                'ソフトテニス実業団最高峰リーグ「STリーグ」の概要、仕組み、観戦の見どころについて解説します。',
              url: pageUrl,
            }),
          }}
        />
      </Head>

      <PageLayout className="space-y-12">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: 'STリーグとは', href: '/st-league/about' },
          ]}
        />

        {/* Header */}
        <section className="max-w-3xl mx-auto mb-10 px-4">
          <h1 className="text-2xl font-bold mb-4">STリーグとは</h1>
          <p className="text-lg leading-relaxed mb-4">
            <strong>STリーグ（エスティーリーグ）</strong>
            は、日本のソフトテニス実業団チームの頂点を決める最高峰のリーグ戦です。
          </p>
          <p className="text-lg leading-relaxed mb-4">
            企業チームとしての誇りと、選手個人のプライドがぶつかり合う熱い戦いの舞台です。
          </p>
        </section>

        {/* Content Block 1: Overview */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-900 dark:text-white border-b pb-4 dark:border-gray-700">
            リーグ概要
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p>
              STリーグ（Soft Tennis League）は、男女とも実業団チームが参加する
              ソフトテニスのトップリーグ戦です。男女それぞれの実業団トップチームが集い、
              <strong>STリーグⅠ・Ⅱ・Ⅲ</strong>
              の階層によるリーグ構造のもと、昇格・降格をかけた戦いが行われます。
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2 text-gray-600 dark:text-gray-300">
              <li>
                <strong className="text-gray-800 dark:text-gray-100">
                  カテゴリー
                </strong>
                ： 男子、女子
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-100">
                  構成
                </strong>
                ： STリーグⅠ・Ⅱ・Ⅲ の階層構造（年度成績で昇降格あり）
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-100">
                  試合形式
                </strong>
                ： 2ダブルス＋1シングル（3本中2本先取）、7ゲームマッチ
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-100">
                  開催時期
                </strong>
                ： 主に秋〜冬（年度によって異なる）
              </li>
            </ul>
          </div>
        </section>

        {/* Content Block 2: Format */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-900 dark:text-white border-b pb-4 dark:border-gray-700">
            試合形式
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p>
              団体戦形式で行われ、基本的には
              <strong>3本勝負（2ダブルス・1シングルス）</strong>
              で勝敗を決します。
            </p>
            <div className="mt-6 bg-white dark:bg-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-3 text-center">
                標準的なオーダー順
              </h3>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm w-full md:w-32 border border-blue-100 dark:border-gray-600">
                  <span className="block text-xs text-gray-500 mb-1">
                    第1試合
                  </span>
                  <strong className="text-blue-600 font-bold">ダブルス</strong>
                </div>
                <div className="text-gray-400">→</div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm w-full md:w-32 border border-blue-100 dark:border-gray-600">
                  <span className="block text-xs text-gray-500 mb-1">
                    第2試合
                  </span>
                  <strong className="text-indigo-600 font-bold">
                    シングルス
                  </strong>
                </div>
                <div className="text-gray-400">→</div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm w-full md:w-32 border border-blue-100 dark:border-gray-600">
                  <span className="block text-xs text-gray-500 mb-1">
                    第3試合
                  </span>
                  <strong className="text-blue-600 font-bold">ダブルス</strong>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4 text-center">
                ※ 大会規定により変更となる場合があります。
              </p>
            </div>
          </div>
        </section>

        {/* Content Block 2.5: League structure & playoff */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-900 dark:text-white border-b pb-4 dark:border-gray-700">
            リーグ構成と昇格・降格
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p>
              STリーグは男女それぞれが
              <strong>STリーグⅠ・Ⅱ・Ⅲ</strong>
              の階層に分かれており、各リーグ内で総当たり戦を行います。最上位の
              <strong>STリーグⅠ</strong>
              には実業団のトップチームが集まり、その年の日本一を争います。
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold shrink-0">
                  Ⅰ
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300 m-0">
                  <strong>STリーグⅠ</strong>
                  ：最上位リーグ。下位チームはプレーオフ（入替戦）で残留を懸けて戦う。
                </p>
              </div>
              <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-500 text-white text-sm font-bold shrink-0">
                  Ⅱ
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300 m-0">
                  <strong>STリーグⅡ</strong>
                  ：上位チームはプレーオフでⅠ部昇格を目指す。下位はⅢ部との入替対象。
                </p>
              </div>
              <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-400 text-white text-sm font-bold shrink-0">
                  Ⅲ
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300 m-0">
                  <strong>STリーグⅢ</strong>
                  ：上位チームはⅡ部昇格を目指す。
                </p>
              </div>
            </div>
            <p className="mt-6">
              リーグ戦終了後には
              <strong>STリーグプレーオフ（入替戦）</strong>
              が行われ、上位リーグの下位チームと下位リーグの上位チームが翌年度の所属を懸けて対戦します。これにより毎年メンバーが入れ替わり、各リーグの競争が保たれます。
            </p>
          </div>
        </section>

        {/* Content Block 3: Highlights */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-900 dark:text-white border-b pb-4 dark:border-gray-700">
            見どころ
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-lg mb-2">最高レベルの技術</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                ナショナルチーム所属選手など、日本のトッププレイヤーが多数出場。
                世界レベルのプレーを間近で見ることができます。
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">チームの絆</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                個人戦とは異なり、企業の看板を背負った団体戦ならではの緊張感と、
                チーム一丸となった応援やベンチワークも見どころの一つです。
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">昇格・残留争い</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                優勝争いはもちろん、下位チームの入れ替え戦回避をかけた残留争いも熾烈です。
                1つの勝利、1つのゲームが順位に大きく影響します。
              </p>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
