// コンテンツスクリプト - Webページ内で実行される
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === 'ping') {
            // ping-pong：コンテンツスクリプトの生存確認
            sendResponse({ status: 'alive' });
        } else if (request.action === 'extractLinks') {
            // ページの読み込み状態をチェック
            if (document.readyState === 'loading') {
                // まだ読み込み中の場合は、読み込み完了を待つ
                document.addEventListener('DOMContentLoaded', () => {
                    try {
                        const links = extractAllLinks();
                        sendResponse({ links: links });
                    } catch (error) {
                        console.error('リンク抽出エラー (DOMContentLoaded):', error);
                        sendResponse({ links: [], error: error.message });
                    }
                });
            } else {
                // すでに読み込み完了している場合
                const links = extractAllLinks();
                sendResponse({ links: links });
            }
        }
    } catch (error) {
        console.error('コンテンツスクリプトエラー:', error);
        sendResponse({ links: [], error: error.message });
    }
    return true; // 非同期レスポンスを有効にする
});

function extractAllLinks() {
    try {
        const links = [];
        const processedUrls = new Set(); // 重複を避けるため
        
        // DOMが存在するかチェック
        if (!document || !document.querySelectorAll) {
            throw new Error('DOMが利用できません');
        }
        
        // すべてのaタグを取得
        const anchorElements = document.querySelectorAll('a[href]');
        console.log(`${anchorElements.length}個のアンカー要素を検出しました`);
        
        anchorElements.forEach((anchor, index) => {
            try {
                const href = anchor.getAttribute('href');
                if (!href || href.trim() === '') return;
                
                // 相対URLを絶対URLに変換
                const absoluteUrl = new URL(href, window.location.href).href;
                
                // 重複チェック
                if (processedUrls.has(absoluteUrl)) return;
                processedUrls.add(absoluteUrl);
                
                // 無効なリンクをフィルタリング
                if (absoluteUrl.startsWith('javascript:') || 
                    absoluteUrl.startsWith('mailto:') ||
                    absoluteUrl.startsWith('tel:') ||
                    absoluteUrl.startsWith('data:') ||
                    absoluteUrl.startsWith('blob:') ||
                    absoluteUrl === window.location.href + '#' ||
                    absoluteUrl.endsWith('#')) {
                    return;
                }
                
                const linkText = anchor.textContent ? anchor.textContent.trim() : '';
                const url = new URL(absoluteUrl);
                
                links.push({
                    text: linkText,
                    url: absoluteUrl,
                    domain: url.hostname,
                    protocol: url.protocol,
                    pathname: url.pathname,
                    isExternal: url.hostname !== window.location.hostname,
                    hasTitle: !!anchor.title,
                    title: anchor.title || '',
                    target: anchor.target || '_self'
                });
            } catch (error) {
                // 個別のURLの解析に失敗した場合はスキップ
                console.warn(`URL解析エラー (${index}番目):`, error, anchor.getAttribute('href'));
            }
        });
        
        // ドメイン別でソート
        links.sort((a, b) => {
            if (a.domain !== b.domain) {
                return a.domain.localeCompare(b.domain);
            }
            return a.url.localeCompare(b.url);
        });
        
        console.log(`最終的に${links.length}個の有効なリンクを抽出しました`);
        return links;
        
    } catch (error) {
        console.error('リンク抽出処理でエラーが発生しました:', error);
        throw error;
    }
}

// ページ読み込み完了時の自動実行（オプション）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('URL Link Extractor: ページ読み込み完了');
    });
} else {
    console.log('URL Link Extractor: 準備完了');
}