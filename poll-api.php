<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$dataDir = __DIR__ . '/polls-data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0750, true);
}
$htaccessPath = $dataDir . '/.htaccess';
if (!file_exists($htaccessPath)) {
    @file_put_contents($htaccessPath, "Require all denied\nDeny from all\n");
}

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function validId(string $id): bool {
    return (bool) preg_match('/^[a-zA-Z0-9_-]{4,32}$/', $id);
}

$action = $_GET['action'] ?? '';

if ($action === 'ping') {
    respond(200, ['ok' => true, 'mode' => 'server']);
}

if ($action === 'get') {
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

$body = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($body)) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON body']);
}

if ($action === 'create') {
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
    if ($expiresAt <= $nowMs) {
        respond(400, ['ok' => false, 'error' => 'Expiry must be in the future']);
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
    $id = (string) ($body['id'] ?? '');
    $choices = $body['choices'] ?? [];
    if (!validId($id) || !is_array($choices) || count($choices) === 0) {
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

respond(400, ['ok' => false, 'error' => 'Unknown action']);
