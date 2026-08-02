type DevOnlyNoticeProps = {
  title: string;
  message: string;
};

/**
 * `isDebugMode()` / `hasLiveMatchApi()` の条件を満たさない環境で
 * beta/matches 管理系ページに表示するアクセス拒否・編集不可の通知。
 */
const DevOnlyNotice = ({ title, message }: DevOnlyNoticeProps) => (
  <div className="mx-auto max-w-4xl p-6">
    <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      <strong className="font-bold">{title}</strong>
      <span className="ml-2 block sm:inline">{message}</span>
    </div>
  </div>
);

export default DevOnlyNotice;
