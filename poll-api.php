<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('X-Robots-Tag: noindex, nofollow');

$dataDir = __DIR__ . '/polls-data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0750, true);
}
$htaccessPath = $dataDir . '/.htaccess';
$desiredHtaccess = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
if (!file_exists($htaccessPath)) {
    @file_put_contents($htaccessPath, $desiredHtaccess);
}

$rateDir = $dataDir . '/.rate';
$banDir = $dataDir . '/.bans';
if (!is_dir($rateDir)) {
    @mkdir($rateDir, 0750, true);
}
if (!is_dir($banDir)) {
    @mkdir($banDir, 0750, true);
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function validId(string $id): bool {
    return (bool) preg_match('/^qp_[a-zA-Z0-9]{6,24}$/', $id);
}

function getApiSecret(string $dataDir): string {
    $secretFile = $dataDir . '/.secret';
    if (is_file($secretFile)) {
        $existing = trim((string) @file_get_contents($secretFile));
        if (strlen($existing) >= 32) {
            return $existing;
        }
    }
    $secret = bin2hex(random_bytes(32));
    @file_put_contents($secretFile, $secret, LOCK_EX);
    @chmod($secretFile, 0640);
    return $secret;
}

function clientIpHash(): string {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return hash('sha256', $ip . '|' . __DIR__);
}

function isIpBanned(string $banDir): bool {
    $banFile = $banDir . '/' . clientIpHash() . '.json';
    if (!is_file($banFile)) {
        return false;
    }
    $data = json_decode((string) @file_get_contents($banFile), true);
    if (!is_array($data)) {
        return false;
    }
    $until = (int) ($data['until'] ?? 0);
    if ($until > time()) {
        return true;
    }
    @unlink($banFile);
    return false;
}

function recordStrike(string $banDir, string $rateDir): void {
    $strikeFile = $rateDir . '/strike_' . clientIpHash() . '.json';
    $now = time();
    $fp = @fopen($strikeFile, 'c+');
    if (!$fp) {
        return;
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $hits = json_decode($raw ?: '[]', true);
    if (!is_array($hits)) {
        $hits = [];
    }
    $cutoff = $now - 600;
    $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $cutoff));
    $hits[] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($hits));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if (count($hits) >= 5) {
        $banFile = $banDir . '/' . clientIpHash() . '.json';
        @file_put_contents($banFile, json_encode(['until' => $now + 1800]), LOCK_EX);
    }
}

function proxyRiskScore(): int {
    $score = 0;
    if (!empty($_SERVER['HTTP_PROXY_CONNECTION']) || !empty($_SERVER['HTTP_X_PROXY_ID'])) {
        $score += 2;
    }
    if (!empty($_SERVER['HTTP_VIA']) || !empty($_SERVER['HTTP_FORWARDED'])) {
        $score += 1;
    }
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $score += 1;
    }
    $xff = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    if ($xff !== '') {
        $hops = array_filter(array_map('trim', explode(',', $xff)));
        if (count($hops) >= 2) {
            $score += 1;
        }
    }
    return $score;
}

function verifySameHostOrigin(): void {
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return;
    }
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '') {
        $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
        $originPort = parse_url($origin, PHP_URL_PORT);
        $hostOnly = strtolower(explode(':', $host)[0]);
        if ($originHost !== '' && $originHost !== $hostOnly && ($originPort ? "{$originHost}:{$originPort}" : $originHost) !== $host) {
            respond(403, ['ok' => false, 'error' => 'Origin not permitted']);
        }
    }
}

function verifyRequestToken(string $dataDir, string $banDir, string $rateDir): void {
    $token = (string) ($_SERVER['HTTP_X_QP_TOKEN'] ?? '');
    $tsStr = (string) ($_SERVER['HTTP_X_QP_TS'] ?? '');
    $nonce = (string) ($_SERVER['HTTP_X_QP_NONCE'] ?? '');

    if ($token === '' || $tsStr === '' || $nonce === '' || !ctype_digit($tsStr) || strlen($nonce) > 32) {
        recordStrike($banDir, $rateDir);
        respond(401, ['ok' => false, 'code' => 'stale_token', 'error' => 'Security challenge required']);
    }

    $ts = (int) $tsStr;
    $now = time();
    if (abs($now - $ts) > 1800) {
        respond(401, ['ok' => false, 'code' => 'stale_token', 'error' => 'Security token expired']);
    }

    $secret = getApiSecret($dataDir);
    $expected = hash_hmac('sha256', $ts . '|' . clientIpHash(), $secret);
    if (!hash_equals($expected, $token)) {
        respond(401, ['ok' => false, 'code' => 'stale_token', 'error' => 'Invalid security token']);
    }

    $powHash = hash('sha256', $token . ':' . $ts . ':' . $nonce);
    if (substr($powHash, 0, 2) !== '00') {
        recordStrike($banDir, $rateDir);
        respond(403, ['ok' => false, 'error' => 'Invalid proof token']);
    }
}

function enforceRateLimit(string $rateDir, string $banDir, string $bucket, int $maxHits, int $windowSec, bool $global = false): void {
    $suffix = $global ? 'global' : clientIpHash();
    $file = $rateDir . '/' . $bucket . '_' . $suffix . '.json';
    $now = time();
    $fp = @fopen($file, 'c+');
    if (!$fp) {
        return;
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $hits = json_decode($raw ?: '[]', true);
    if (!is_array($hits)) {
        $hits = [];
    }
    $cutoff = $now - $windowSec;
    $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $cutoff));
    if (count($hits) >= $maxHits) {
        flock($fp, LOCK_UN);
        fclose($fp);
        if (!$global) {
            recordStrike($banDir, $rateDir);
        }
        respond(429, ['ok' => false, 'error' => 'Rate limit exceeded. Please wait a moment.']);
    }
    $hits[] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($hits));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

function readJsonBodyLimited(int $maxBytes = 16384): array {
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if ($contentType !== '' && strpos($contentType, 'application/json') === false) {
        respond(415, ['ok' => false, 'error' => 'Content-Type must be application/json']);
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        respond(413, ['ok' => false, 'error' => 'Request body too large']);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(400, ['ok' => false, 'error' => 'Invalid JSON body']);
    }
    return $decoded;
}

if (isIpBanned($banDir)) {
    respond(403, ['ok' => false, 'error' => 'Access temporarily blocked by firewall.']);
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string) ($_GET['action'] ?? '');

if (!in_array($action, ['ping', 'get', 'create', 'vote'], true)) {
    respond(400, ['ok' => false, 'error' => 'Unsupported action']);
}

if ($action === 'ping') {
    if (!in_array($method, ['GET', 'HEAD'], true)) {
        respond(405, ['ok' => false, 'error' => 'Method not allowed']);
    }
    $ts = time();
    $secret = getApiSecret($dataDir);
    $token = hash_hmac('sha256', $ts . '|' . clientIpHash(), $secret);
    respond(200, [
        'ok' => true,
        'mode' => 'server',
        'token' => $token,
        'ts' => $ts,
        'diff' => 2,
    ]);
}

if ($action === 'get') {
    if ($method !== 'GET') {
        respond(405, ['ok' => false, 'error' => 'Method not allowed']);
    }
    $id = (string) ($_GET['id'] ?? '');
    if (!validId($id)) {
        respond(400, ['ok' => false, 'error' => 'Invalid poll ID']);
    }
    $file = $dataDir . '/' . $id . '.json';
    if (!is_file($file)) {
        respond(404, ['ok' => false, 'error' => 'Poll not found']);
    }
    $fp = fopen($file, 'r');
    if (!$fp) {
        respond(500, ['ok' => false, 'error' => 'Unable to read poll']);
    }
    flock($fp, LOCK_SH);
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $poll = json_decode($raw ?: '', true);
    if (!is_array($poll)) {
        respond(500, ['ok' => false, 'error' => 'Corrupt poll data']);
    }
    respond(200, ['ok' => true, 'poll' => $poll]);
}

if ($method !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

verifySameHostOrigin();
verifyRequestToken($dataDir, $banDir, $rateDir);

$risk = proxyRiskScore();
$body = readJsonBodyLimited(16384);

if ($action === 'create') {
    enforceRateLimit($rateDir, $banDir, 'create_global', 150, 600, true);
    enforceRateLimit($rateDir, $banDir, 'create', $risk > 0 ? 3 : 15, 600, false);

    $question = trim((string) ($body['q'] ?? ''));
    $rawOpts = $body['opts'] ?? [];
    if ($question === '' || mb_strlen($question) > 180) {
        respond(400, ['ok' => false, 'error' => 'Invalid question']);
    }
    if (!is_array($rawOpts) || count($rawOpts) < 2 || count($rawOpts) > 8) {
        respond(400, ['ok' => false, 'error' => 'Provide 2 to 8 options']);
    }
    $opts = [];
    foreach ($rawOpts as $o) {
        $text = trim((string) $o);
        if ($text === '' || mb_strlen($text) > 90) {
            respond(400, ['ok' => false, 'error' => 'Invalid option text']);
        }
        $opts[] = $text;
    }

    $expiresAt = (int) ($body['expiresAt'] ?? 0);
    $nowMs = (int) round(microtime(true) * 1000);
    $maxFutureMs = $nowMs + (366 * 86400 * 1000);
    if ($expiresAt <= $nowMs || $expiresAt > $maxFutureMs) {
        respond(400, ['ok' => false, 'error' => 'Expiry must be between now and 365 days']);
    }

    $allowedThemes = ['sovereign', 'crimson-gold', 'cobalt-purple'];
    $theme = in_array($body['theme'] ?? '', $allowedThemes, true) ? $body['theme'] : 'sovereign';

    $allowedIcons = [
        '',
        'assets/icon-vote.png',
        'assets/icon-poll.png',
        'assets/icon-timer.png',
        'assets/icon-share.png',
    ];
    $icon = in_array($body['icon'] ?? '', $allowedIcons, true) ? $body['icon'] : 'assets/icon-vote.png';

    $id = 'qp_' . bin2hex(random_bytes(5));
    $poll = [
        'id' => $id,
        'q' => $question,
        'opts' => $opts,
        'multi' => (bool) ($body['multi'] ?? false),
        'theme' => $theme,
        'icon' => $icon,
        'createdAt' => $nowMs,
        'expiresAt' => $expiresAt,
        'votes' => array_fill(0, count($opts), 0),
    ];

    $file = $dataDir . '/' . $id . '.json';
    $written = @file_put_contents($file, json_encode($poll, JSON_UNESCAPED_SLASHES), LOCK_EX);
    if ($written === false) {
        respond(500, ['ok' => false, 'error' => 'Failed to persist poll']);
    }
    respond(201, ['ok' => true, 'id' => $id, 'poll' => $poll]);
}

if ($action === 'vote') {
    enforceRateLimit($rateDir, $banDir, 'vote', $risk > 0 ? 12 : 60, 600, false);

    $id = (string) ($body['id'] ?? '');
    $choices = $body['choices'] ?? [];
    if (!validId($id) || !is_array($choices) || count($choices) === 0 || count($choices) > 8) {
        respond(400, ['ok' => false, 'error' => 'Invalid vote payload']);
    }

    $file = $dataDir . '/' . $id . '.json';
    if (!is_file($file)) {
        respond(404, ['ok' => false, 'error' => 'Poll not found']);
    }

    $fp = fopen($file, 'c+');
    if (!$fp) {
        respond(500, ['ok' => false, 'error' => 'Unable to open poll']);
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $poll = json_decode($raw ?: '', true);

    if (!is_array($poll)) {
        flock($fp, LOCK_UN);
        fclose($fp);
        respond(500, ['ok' => false, 'error' => 'Corrupt poll']);
    }

    $nowMs = (int) round(microtime(true) * 1000);
    if ($nowMs >= (int) $poll['expiresAt']) {
        flock($fp, LOCK_UN);
        fclose($fp);
        respond(410, ['ok' => false, 'error' => 'Poll expired', 'poll' => $poll]);
    }

    $optCount = count($poll['opts']);
    $uniqueChoices = array_values(array_unique(array_map('intval', $choices)));
    if (empty($poll['multi']) && count($uniqueChoices) > 1) {
        $uniqueChoices = [$uniqueChoices[0]];
    }

    foreach ($uniqueChoices as $idx) {
        if ($idx >= 0 && $idx < $optCount) {
            $poll['votes'][$idx] = (int) ($poll['votes'][$idx] ?? 0) + 1;
        }
    }

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($poll, JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    respond(200, ['ok' => true, 'poll' => $poll]);
}
