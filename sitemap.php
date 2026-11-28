<?php
header('Content-Type: application/xml; charset=utf-8');
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'quickpollnow.com';
$dir = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\');
$base = $scheme . '://' . $host . ($dir ? $dir : '') . '/';

$indexMtime = @filemtime(__DIR__ . '/index.html') ?: time();
$llmsMtime = @filemtime(__DIR__ . '/llms.txt') ?: $indexMtime;
$mdMtime = @filemtime(__DIR__ . '/index.md') ?: $indexMtime;

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc><?= htmlspecialchars($base, ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= gmdate('Y-m-d\TH:i:s\Z', $indexMtime) ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc><?= htmlspecialchars($base . 'llms.txt', ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= gmdate('Y-m-d\TH:i:s\Z', $llmsMtime) ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc><?= htmlspecialchars($base . 'index.md', ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= gmdate('Y-m-d\TH:i:s\Z', $mdMtime) ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
