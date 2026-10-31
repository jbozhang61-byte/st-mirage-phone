/** Google / Yandex / Wikipedia / Z-Library：和正文连动的搜索与资料。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getData, saveNow, getCast } from '../store.js';
import { openPostPage } from './postpage.js';
import { generateSearchResults, generateWikiArticle, generateBooks, generateBookExcerpt } from '../storyseed.js';

const CONFIG = {
    google: { name: 'Google', sub: 'SEARCH', cls: 'is-google', placeholder: '搜索这个世界的任何事' },
    yandex: { name: 'Yandex', sub: 'ПОИСК', cls: 'is-yandex', placeholder: 'Искать в этом мире' },
    wiki: { name: 'Wikipedia', sub: '百科', cls: 'is-wiki', placeholder: '搜索条目' },
    zlib: { name: 'Z-Library', sub: '电子书库', cls: 'is-zlib', placeholder: '搜书名、作者、题材' },
};

export function mountWebApp(kind) {
    return (host, { nav }) => mount(host, nav, kind);
}

function fallbackResults(query) {
    return [
        { title: query + ' · 旧城百科', url: 'oldcity.wiki/' + encodeURIComponent(query), snippet: '关于「' + query + '」的条目，包含在旧城出现的时间、相关人物和最近的传闻。' },
        { title: '有人知道 ' + query + ' 吗？', url: 'bbs.oldcity/thread/2041', snippet: '论坛里的讨论帖，回复不多，但有一条说在雪夜见过。' },
        { title: query + ' — 本地新闻', url: 'news.oldcity/' + encodeURIComponent(query), snippet: '本地媒体整理的资料，时间线和正文里的事对得上。' },
        { title: '关于 ' + query + ' 的旧照片', url: 'archive.oldcity/photo', snippet: '一张模糊的照片，背景是钟楼和还没拆的旧街。' },
    ];
}

function mount(host, nav, kind) {
    const config = CONFIG[kind];
    nav.setChrome?.(kind === 'zlib' ? 'dark' : 'light');
    let busy = false;
    let query = '';
    let results = [];
    let article = null;
    let books = [];
    let tab = 'search';   // zlib：搜索 / 书库

    const body = h('div', { class: 'mp-webapp__body' });
    const input = h('input', { class: 'mp-webapp__input', type: 'search', placeholder: config.placeholder });
    const submit = h('button', { type: 'button', class: 'mp-webapp__go', 'aria-label': '搜索' }, icon('search'));
    const tabsBar = kind === 'zlib'
        ? h('div', { class: 'mp-zlib__tabs' },
            h('button', { type: 'button', class: 'mp-zlib__tab is-on', text: '搜索', onclick: () => switchTab('search') }),
            h('button', { type: 'button', class: 'mp-zlib__tab', text: '书库', onclick: () => switchTab('books') }))
        : null;
    const el = h('div', { class: 'mp-webapp ' + config.cls },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, config.name, h('small', { text: config.sub })),
            h('div', { class: 'mp-nav__spacer' }),
        ),
        h('div', { class: 'mp-webapp__search' }, input, submit),
        tabsBar,
        body,
    );

    function switchTab(next) {
        tab = next;
        [...(tabsBar?.children || [])].forEach(button => button.classList.toggle('is-on', (button.textContent === '书库') === (tab === 'books')));
        paint();
    }
    host.appendChild(el);

    function paint() {
        body.innerHTML = '';
        if (busy) {
            body.appendChild(h('div', { class: 'mp-webapp__state' }, h('span', { class: 'mp-webapp__dots' }, h('i'), h('i'), h('i')), '正在翻这个世界…'));
            return;
        }
        if (kind === 'wiki') {
            if (!article) {
                body.appendChild(h('div', { class: 'mp-webapp__hero' },
                    h('div', { class: 'mp-webapp__logo' }, icon('book')),
                    h('div', { class: 'mp-webapp__title', text: query ? '没有找到「' + query + '」' : '搜索这个世界' }),
                    h('div', { class: 'mp-webapp__sub', text: '条目会按最近正文和记忆库生成。' }),
                ));
                return;
            }
            body.appendChild(h('article', { class: 'mp-wiki' },
                h('h1', { text: article.title }),
                h('p', { class: 'mp-wiki__summary', text: article.summary }),
                ...article.sections.map(section => h('section', {},
                    h('h2', { text: section.h }),
                    h('p', { text: section.p }),
                )),
                h('div', { class: 'mp-wiki__foot', text: '来自这个世界 · 百科条目' }),
            ));
            return;
        }
        if (kind === 'zlib') {
            if (tab === 'books') { drawBooks(); return; }
            if (!books.length) {
                body.appendChild(h('div', { class: 'mp-webapp__hero' },
                    h('div', { class: 'mp-webapp__logo' }, icon('book')),
                    h('div', { class: 'mp-webapp__title', text: query ? '没有找到「' + query + '」' : '找一本书' }),
                    h('div', { class: 'mp-webapp__sub', text: '书库会按正文、记忆库和角色的性格、阶级、立场生成。' }),
                ));
                const cast = getCast();
                if (!query && cast.length) {
                    body.appendChild(h('div', { class: 'mp-zlib__shelf-title', text: '角色书架' }));
                    body.appendChild(h('div', { class: 'mp-zlib__shelf' },
                        ...cast.slice(0, 8).map(person => h('button', {
                            type: 'button', class: 'mp-zlib__shelf-item',
                            onclick: () => { input.value = person.name; search(); },
                        }, avatar({ name: person.name, size: 42 }), h('span', { text: person.name }))),
                    ));
                }
                return;
            }
            for (const book of books) {
                body.appendChild(h('button', { type: 'button', class: 'mp-zlib__book', onclick: () => openBook(book) },
                    h('div', { class: 'mp-zlib__cover', text: (book.title || '书').slice(0, 1) }),
                    h('div', { class: 'mp-zlib__main' },
                        h('div', { class: 'mp-zlib__title', text: book.title }),
                        h('div', { class: 'mp-zlib__meta', text: [book.author, book.year ? book.year + ' 年' : '', book.format].filter(Boolean).join(' · ') }),
                        book.owner ? h('div', { class: 'mp-zlib__why', text: '适合 ' + book.owner }) : null,
                        h('div', { class: 'mp-zlib__desc', text: book.desc }),
                    ),
                ));
            }
            return;
        }
        if (!results.length) {
            body.appendChild(h('div', { class: 'mp-webapp__hero' },
                h('div', { class: 'mp-webapp__logo' }, icon('search')),
                h('div', { class: 'mp-webapp__title', text: query ? '没有找到「' + query + '」' : '搜点什么' }),
                h('div', { class: 'mp-webapp__sub', text: '结果会参考最近正文、记忆库和手机里的聊天。' }),
            ));
            return;
        }
        body.appendChild(h('div', { class: 'mp-webapp__count', text: '找到 ' + results.length + ' 条结果' }));
        for (const result of results) {
            body.appendChild(h('button', { type: 'button', class: 'mp-webapp__result', onclick: () => openPostPage({
                item: result, app: config.name, title: result.title,
                body: result.snippet + '\n\n' + result.url,
                meta: result.url,
            }) },
                h('div', { class: 'mp-webapp__result-url', text: result.url }),
                h('div', { class: 'mp-webapp__result-title', text: result.title }),
                h('div', { class: 'mp-webapp__result-snippet', text: result.snippet }),
            ));
        }
    }

    /** 书库：这部手机里已经"下载"过的书。 */
    function drawBooks() {
        const saved = Object.values(getData().books || {}).filter(book => book && book.title);
        if (!saved.length) {
            body.appendChild(h('div', { class: 'mp-webapp__hero' },
                h('div', { class: 'mp-webapp__logo' }, icon('book')),
                h('div', { class: 'mp-webapp__title', text: '书库是空的' }),
                h('div', { class: 'mp-webapp__sub', text: '搜到想看的书，点下载就会存到这里。' }),
            ));
            return;
        }
        body.appendChild(h('div', { class: 'mp-webapp__count', text: saved.length + ' 本' }));
        for (const book of saved) {
            body.appendChild(h('button', { type: 'button', class: 'mp-zlib__book', onclick: () => openSavedBook(book) },
                h('div', { class: 'mp-zlib__cover', text: (book.title || '书').slice(0, 1) }),
                h('div', { class: 'mp-zlib__main' },
                    h('div', { class: 'mp-zlib__title', text: book.title }),
                    h('div', { class: 'mp-zlib__meta', text: [book.author, book.year ? book.year + ' 年' : '', book.format].filter(Boolean).join(' · ') }),
                    h('div', { class: 'mp-zlib__desc', text: book.desc || '没有简介。' }),
                ),
            ));
        }
    }

    function openSavedBook(book) {
        const dialog = sheet({
            title: book.title,
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-zlib__detailmeta', text: [book.author, book.year ? book.year + ' 年' : '', book.format].filter(Boolean).join(' · ') }),
                h('div', { class: 'mp-zlib__desc', text: book.desc || '没有更多简介。' }),
                h('div', { class: 'mp-st-hint', text: '已保存在这部手机的书库。' }),
            ),
            actions: h('div', { class: 'mp-reader__acts' },
                h('button', { class: 'mp-btn ghost small', type: 'button', text: '试读', onclick: () => { dialog.close(); openReader(book); } }),
                h('button', {
                    class: 'mp-btn ghost small', type: 'button', text: '移出书库',
                    onclick: () => {
                        const data = getData();
                        if (data.books) delete data.books[book.title];
                        saveNow('data');
                        dialog.close();
                        paint();
                        toast('已移出书库');
                    },
                })),
        });
        return dialog;
    }

    function openBook(book) {
        sheet({
            title: book.title,
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-zlib__detailmeta', text: [book.author, book.year ? book.year + ' 年' : '', book.format].filter(Boolean).join(' · ') }),
                book.owner ? h('div', { class: 'mp-zlib__why', text: '适合 ' + book.owner + (book.why ? '：' + book.why : '') }) : null,
                h('div', { class: 'mp-zlib__desc', text: book.desc || '没有更多简介。' }),
                h('div', { class: 'mp-st-hint', text: '下载会保存到手机书库。' }),
            ),
            actions: h('div', { class: 'mp-reader__acts' },
                h('button', { class: 'mp-btn ghost small', type: 'button', text: '试读', onclick: () => { dialog.close(); openReader(book); } }),
                h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '下载',
                    onclick: () => { saveBook(book); dialog.close(); },
                })),
        });
        return dialog;
    }

    function saveBook(book) {
        const data = getData();
        data.books = data.books && typeof data.books === 'object' ? data.books : {};
        data.books[book.title] = { ...book, ts: Date.now() };
        saveNow('data');
        toast('已保存到书库');
    }

    /** 阅读页：整页覆盖，正文滚动。 */
    function openReader(book) {
        const screen = document.querySelector('.mp-screen');
        if (!screen) return null;
        const chip = screen.querySelector('.mp-backchip');
        if (chip) chip.style.display = 'none';
        const close = () => {
            page.classList.add('is-closing');
            setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 200);
        };
        const scroll = h('div', { class: 'mp-reader__scroll' });
        const page = h('div', { class: 'mp-reader' },
            h('div', { class: 'mp-reader__bar' },
                h('button', { type: 'button', class: 'mp-reader__back', onclick: close }, icon('back')),
                h('div', { class: 'mp-reader__title', text: book.title || '未命名' }),
                h('button', { type: 'button', class: 'mp-reader__act', 'aria-label': '存进书库', onclick: () => saveBook(book) }, icon('download')),
            ),
            scroll,
        );
        screen.appendChild(page);
        scroll.appendChild(h('div', { class: 'mp-webapp__state' }, h('span', { class: 'mp-webapp__dots' }, h('i'), h('i'), h('i')), '正在翻开…'));
        generateBookExcerpt(book).then(excerpt => {
            scroll.innerHTML = '';
            scroll.appendChild(h('div', { class: 'mp-reader__meta', text: [book.author, book.year ? book.year + ' 年' : '', book.format].filter(Boolean).join(' · ') || '佚名' }));
            scroll.appendChild(h('h1', { class: 'mp-reader__h1', text: book.title || '未命名' }));
            scroll.appendChild(h('h2', { class: 'mp-reader__h2', text: excerpt.chapter }));
            for (const para of String(excerpt.text || '').split(/\n+/)) {
                if (para.trim()) scroll.appendChild(h('p', { class: 'mp-reader__p', text: para.trim() }));
            }
            scroll.appendChild(h('div', { class: 'mp-reader__foot', text: '—— 试读到此为止 ——' }));
            scroll.scrollTop = 0;
        }).catch(() => {
            scroll.innerHTML = '';
            scroll.appendChild(h('div', { class: 'mp-webapp__state', text: '这本书现在翻不开，等会儿再试' }));
        });
        return page;
    }

    async function search() {
        const value = input.value.trim();
        if (!value || busy) return;
        query = value;
        busy = true;
        paint();
        try {
            if (kind === 'wiki') {
                article = await generateWikiArticle(value);
                if (!article) article = { title: value, summary: '关于「' + value + '」的条目。', sections: [{ h: '传闻', p: '旧城的人说，这件事和最近发生的事有关，但没有更多记载。' }] };
            } else if (kind === 'zlib') {
                books = await generateBooks(value);
                if (!books.length) books = [{ title: value + ' 与旧城', author: '佚名', year: 2024, desc: '一本和这个世界有关的电子书。', format: 'EPUB' }];
            } else {
                results = await generateSearchResults({ engine: config.name, query: value });
                if (!results.length) results = fallbackResults(value);
            }
            const data = getData();
            data.webapps = data.webapps && typeof data.webapps === 'object' ? data.webapps : {};
            data.webapps[kind] = { query: value, ts: Date.now() };
            saveNow('data');
        } catch (error) {
            toast(String(error?.message || '搜索失败'), 3000);
        } finally {
            busy = false;
            paint();
        }
    }

    submit.addEventListener('click', search);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') search(); });
    paint();
    return { refresh: paint };
}