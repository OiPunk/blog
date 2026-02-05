const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

const OLD_BLOG_PATH = '/Users/liweiguang/oipunk.github.io';
const NEW_BLOG_PATH = '/Users/liweiguang/tailwind-nextjs-starter-blog';
const BLOG_OUTPUT_PATH = path.join(NEW_BLOG_PATH, 'data/blog');
const IMAGES_OUTPUT_PATH = path.join(NEW_BLOG_PATH, 'public/static/images/blog');

// 初始化 Turndown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// 自定义代码块处理
turndownService.addRule('codeBlock', {
  filter: function (node) {
    return node.nodeName === 'FIGURE' && node.classList.contains('highlight');
  },
  replacement: function (content, node) {
    const $ = cheerio.load(node.outerHTML);
    const lang = $('figure').attr('class')?.split(' ').find(c => c !== 'highlight') || '';
    const code = $('td.code pre').text().trim();
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  }
});

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 从 HTML 文件提取文章信息
function extractArticle(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  // 提取标题
  const title = $('meta[property="og:title"]').attr('content') ||
                $('h1.post-title').text().trim() ||
                $('title').text().trim();

  // 提取日期
  const dateStr = $('meta[property="article:published_time"]').attr('content');
  const date = dateStr ? dateStr.split('T')[0] : '2020-01-01';

  // 提取标签
  const tags = [];
  $('meta[property="article:tag"]').each((i, el) => {
    tags.push($(el).attr('content'));
  });
  if (tags.length === 0) {
    $('.post-tags a').each((i, el) => {
      tags.push($(el).text().replace('#', '').trim());
    });
  }

  // 提取摘要
  const summary = $('meta[property="og:description"]').attr('content') ||
                  $('meta[name="description"]').attr('content') ||
                  title;

  // 提取正文
  const postBody = $('.post-body').html() || '';

  return { title, date, tags, summary, postBody, htmlPath };
}

// 处理图片路径并复制图片
function processImages(content, articleDir) {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  const images = [];

  while ((match = imgRegex.exec(content)) !== null) {
    images.push(match[1]);
  }

  let processedContent = content;

  images.forEach(imgSrc => {
    // 处理相对路径的图片
    let srcPath;
    if (imgSrc.startsWith('/')) {
      srcPath = path.join(OLD_BLOG_PATH, imgSrc);
    } else {
      srcPath = path.join(articleDir, imgSrc);
    }

    if (fs.existsSync(srcPath)) {
      const imgName = path.basename(srcPath);
      const articleSlug = path.basename(path.dirname(articleDir));
      const destDir = path.join(IMAGES_OUTPUT_PATH, articleSlug);
      ensureDir(destDir);

      const destPath = path.join(destDir, imgName);
      try {
        fs.copyFileSync(srcPath, destPath);
        // 更新图片路径
        const newPath = `/static/images/blog/${articleSlug}/${imgName}`;
        processedContent = processedContent.replace(imgSrc, newPath);
      } catch (e) {
        console.log(`  警告: 无法复制图片 ${srcPath}`);
      }
    }
  });

  return processedContent;
}

// 转换 HTML 到 Markdown
function htmlToMarkdown(html) {
  // 预处理：移除 headerlink
  html = html.replace(/<a[^>]*class="headerlink"[^>]*>[^<]*<\/a>/g, '');

  // 处理代码块
  const $ = cheerio.load(html);
  $('figure.highlight').each((i, el) => {
    const lang = $(el).attr('class')?.split(' ').find(c => c !== 'highlight') || '';
    const code = $(el).find('td.code pre').text().trim();
    $(el).replaceWith(`<pre><code class="language-${lang}">${code}</code></pre>`);
  });

  return turndownService.turndown($.html());
}

// 生成文件名（slug）
function generateSlug(title, date) {
  // 简单的 slug 生成
  const slug = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${date}-${slug}`;
}

// 主函数
async function migrate() {
  console.log('开始迁移博客文章...\n');

  ensureDir(BLOG_OUTPUT_PATH);
  ensureDir(IMAGES_OUTPUT_PATH);

  // 清空旧的示例文章
  const existingFiles = fs.readdirSync(BLOG_OUTPUT_PATH);
  existingFiles.forEach(file => {
    if (file.endsWith('.mdx') || file.endsWith('.md')) {
      fs.unlinkSync(path.join(BLOG_OUTPUT_PATH, file));
    }
  });

  // 查找所有文章
  const articles = [];
  const year2020 = path.join(OLD_BLOG_PATH, '2020');

  function findArticles(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        const indexPath = path.join(itemPath, 'index.html');
        if (fs.existsSync(indexPath) && !itemPath.includes('/page/')) {
          articles.push(indexPath);
        } else {
          findArticles(itemPath);
        }
      }
    });
  }

  findArticles(year2020);

  console.log(`找到 ${articles.length} 篇文章\n`);

  let successCount = 0;
  let failCount = 0;

  for (const articlePath of articles) {
    try {
      const article = extractArticle(articlePath);
      const articleDir = path.dirname(articlePath);

      console.log(`处理: ${article.title}`);

      // 处理图片
      let processedHtml = processImages(article.postBody, articleDir);

      // 转换为 Markdown
      let markdown = htmlToMarkdown(processedHtml);

      // 更新 markdown 中的图片路径
      const articleSlug = path.basename(path.dirname(articleDir));
      markdown = markdown.replace(/!\[([^\]]*)\]\(\/2020\/[^)]+\/([^)]+)\)/g,
        `![$1](/static/images/blog/${articleSlug}/$2)`);

      // 生成 frontmatter
      const slug = generateSlug(article.title, article.date);
      const frontmatter = `---
title: '${article.title.replace(/'/g, "''")}'
date: '${article.date}'
tags: [${article.tags.map(t => `'${t}'`).join(', ')}]
draft: false
summary: '${article.summary.replace(/'/g, "''")}'
---

`;

      // 写入文件
      const outputPath = path.join(BLOG_OUTPUT_PATH, `${slug}.mdx`);
      fs.writeFileSync(outputPath, frontmatter + markdown);

      successCount++;
      console.log(`  ✓ 已保存: ${slug}.mdx`);

    } catch (e) {
      failCount++;
      console.log(`  ✗ 失败: ${articlePath}`);
      console.log(`    错误: ${e.message}`);
    }
  }

  console.log(`\n迁移完成!`);
  console.log(`成功: ${successCount} 篇`);
  console.log(`失败: ${failCount} 篇`);
}

migrate();
