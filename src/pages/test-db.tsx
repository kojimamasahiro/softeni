import { useState } from 'react';

const TestDB = () => {
  interface TestResult {
    error?: string;
    matchCreation?: Record<string, unknown>;
    clearData?: Record<string, unknown>;
    status?: number;
    [key: string]: unknown;
  }

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-db');
      const result = await response.json();
      setTestResult(result);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      setTestResult({ error: 'Failed to run test' });
    } finally {
      setLoading(false);
    }
  };

  const testMatchCreation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_name: 'テスト大会',
          team_a: 'テストチームA',
          team_b: 'テストチームB',
          best_of: 5,
        }),
      });

      const result = await response.json();
      console.log('Match creation result:', result);
      setTestResult({ matchCreation: result, status: response.status });
    } catch (error) {
      console.error('Match creation error:', error);
      setTestResult({ error: 'Failed to create match', details: error });
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    if (
      !confirm(
        'すべてのマッチデータを削除しますか？\nこの操作は元に戻せません。',
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/clear-data', {
        method: 'POST',
      });

      const result = await response.json();
      setTestResult({ clearData: result, status: response.status });
    } catch (error) {
      console.error('Clear data error:', error);
      setTestResult({ error: 'Failed to clear data', details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">データベース接続テスト</h1>

      <div className="space-y-4">
        <button
          onClick={runTest}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
        >
          {loading ? 'テスト中...' : 'DB接続テスト'}
        </button>

        <button
          onClick={testMatchCreation}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-300 ml-4"
        >
          {loading ? 'テスト中...' : 'マッチ作成テスト'}
        </button>

        <button
          onClick={clearAllData}
          disabled={loading}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-300 ml-4"
        >
          {loading ? '削除中...' : '全データ削除'}
        </button>
      </div>

      {testResult && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">テスト結果:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-100 rounded">
        <h3 className="font-semibold mb-2">セットアップ手順:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Supabaseプロジェクトを作成</li>
          <li>SQL Editorで database/schema.sql を実行</li>
          <li>.env.local の値を確認</li>
          <li>上記のテストボタンでエラーを確認</li>
        </ol>
      </div>
    </div>
  );
};

export default TestDB;
