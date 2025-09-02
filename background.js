// バックグラウンドスクリプト（Service Worker）
chrome.runtime.onInstalled.addListener(() => {
    console.log('URL Link Extractor拡張機能がインストールされました');
});

// アクションボタンがクリックされた時の処理
chrome.action.onClicked.addListener(async (tab) => {
    // ポップアップが設定されているので、この処理は通常実行されない
    console.log('アクションボタンがクリックされました');
});

// メッセージリスナー（将来の拡張用）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'background_task') {
        // バックグラウンドでの処理が必要な場合
        console.log('バックグラウンドタスクを実行');
        sendResponse({ status: 'completed' });
    }
    
    if (request.action === 'copy_success') {
        console.log('クリップボードコピー完了:', request.count + '個のリンク');
    }
});