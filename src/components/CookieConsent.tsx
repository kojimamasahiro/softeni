import { useEffect, useState } from 'react';

type Props = {
  onAccept: () => void;
  onDecline?: () => void;
};

const CookieConsent = ({ onAccept, onDecline }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    onAccept();
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'false');
    onDecline?.();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 w-full bg-gray-800 text-white p-4 text-sm z-50 shadow-md">
      <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <span>
          当サイトは分析目的でCookieを使用します。詳しくは
          <a
            href="/about"
            className="underline text-blue-300 hover:text-blue-200 ml-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            プライバシーポリシー
          </a>
          をご覧ください。
        </span>
        <div className="flex gap-2 mt-2 md:mt-0">
          <button
            onClick={handleAccept}
            className="px-4 py-1 bg-white text-gray-800 text-sm rounded hover:bg-gray-200 transition"
          >
            同意する
          </button>
          <button
            onClick={handleDecline}
            className="px-4 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition"
          >
            拒否する
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
