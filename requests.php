<?php
// requests.php — DAP Object Catalog pending-targets backend
// Lives at myweb.ttu.edu/dperla/DAP_Catalog/requests.php
//
// Endpoints:
//   GET  requests.php                  → list all requests as JSON
//   POST requests.php                  → submit a new request (body: JSON object)
//   POST requests.php?action=status    → update status (body: {id, status, [extra...]})
//   POST requests.php?action=import    → bulk import (body: {requests: [...]}) for one-time localStorage migration
//
// Data file: requests.json in the same directory as this script.
// Concurrent writes are guarded with flock() so two simultaneous submissions
// don't clobber each other.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Same-origin only by default — index.html and request.html are on the same host,
// so they don't need CORS. If you ever embed elsewhere, add an Access-Control-Allow-Origin
// header here for the specific origin.

$DATA_FILE = __DIR__ . '/requests.json';
$method    = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action    = $_GET['action'] ?? '';

// Small helper: respond with JSON and exit
function respond($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Atomic read of the data file. Returns array (empty if file missing/corrupt).
function load_requests($path) {
    if (!file_exists($path)) return [];
    $fp = @fopen($path, 'r');
    if (!$fp) return [];
    $data = [];
    if (flock($fp, LOCK_SH)) {
        $raw = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        if ($raw !== false && strlen($raw) > 0) {
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) $data = $parsed;
        }
    }
    fclose($fp);
    return $data;
}

// Atomic write with exclusive lock. Returns true on success.
function save_requests($path, $arr) {
    $fp = @fopen($path, 'c+');
    if (!$fp) return false;
    $ok = false;
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        $json = json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $ok = (fwrite($fp, $json) !== false);
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return $ok;
}

// Light sanitiser for short text fields
function clean_str($v, $maxlen = 500) {
    if (!is_string($v)) return '';
    $v = trim($v);
    if (strlen($v) > $maxlen) $v = substr($v, 0, $maxlen);
    // Strip control chars except common whitespace
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    return $v;
}

// ──────────────────────────────────────────────────────────────────────
// GET: list all requests
// ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $data = load_requests($DATA_FILE);
    respond(200, $data);
}

// ──────────────────────────────────────────────────────────────────────
// POST: read JSON body
// ──────────────────────────────────────────────────────────────────────
if ($method !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true);
if (!is_array($body)) {
    respond(400, ['error' => 'Invalid JSON body']);
}

// ── POST ?action=status — admin status update (approve/decline) ──
if ($action === 'status') {
    $id     = clean_str($body['id'] ?? '', 100);
    $status = clean_str($body['status'] ?? '', 30);
    if (!$id || !$status) {
        respond(400, ['error' => 'id and status are required']);
    }
    $allowed = ['pending', 'approved', 'declined'];
    if (!in_array($status, $allowed, true)) {
        respond(400, ['error' => 'invalid status value']);
    }
    $data = load_requests($DATA_FILE);
    $found = false;
    foreach ($data as &$r) {
        if (($r['id'] ?? '') === $id) {
            $r['status'] = $status;
            if ($status === 'approved') {
                $r['approvedAt'] = gmdate('c');
                if (!empty($body['catalogId'])) {
                    $r['catalogId'] = clean_str($body['catalogId'], 50);
                }
            } elseif ($status === 'declined') {
                $r['declinedAt'] = gmdate('c');
            }
            $found = true;
            break;
        }
    }
    unset($r);
    if (!$found) respond(404, ['error' => 'request id not found']);
    if (!save_requests($DATA_FILE, $data)) respond(500, ['error' => 'save failed']);
    respond(200, ['ok' => true]);
}

// ── POST ?action=import — one-time bulk import from localStorage ──
if ($action === 'import') {
    $incoming = $body['requests'] ?? null;
    if (!is_array($incoming)) {
        respond(400, ['error' => 'requests array required']);
    }
    $data = load_requests($DATA_FILE);
    $existingIds = array_column($data, 'id');
    $added = 0;
    foreach ($incoming as $req) {
        if (!is_array($req)) continue;
        $rid = clean_str($req['id'] ?? '', 100);
        if (!$rid || in_array($rid, $existingIds, true)) continue;
        $data[] = $req;
        $existingIds[] = $rid;
        $added++;
    }
    if (!save_requests($DATA_FILE, $data)) respond(500, ['error' => 'save failed']);
    respond(200, ['ok' => true, 'added' => $added, 'total' => count($data)]);
}

// ── POST (default) — submit a new request ──
$name       = clean_str($body['name']       ?? '', 200);
$authorName = clean_str($body['author']['name'] ?? ($body['authorName'] ?? ''), 120);
$ra         = clean_str($body['ra']         ?? '', 50);
$dec        = clean_str($body['dec']        ?? '', 50);

if ($name === '')       respond(400, ['error' => 'Target name is required']);
if ($authorName === '') respond(400, ['error' => 'Your name is required']);
if ($ra === '' || $dec === '') respond(400, ['error' => 'Coordinates are required']);

$affiliation  = clean_str($body['author']['affiliation'] ?? ($body['affiliation'] ?? ''), 200);
$equipment    = clean_str($body['request']       ?? ($body['equipment'] ?? ''), 300);
$timing       = clean_str($body['timing']        ?? '', 200);
$justification = clean_str($body['justification']?? '', 2000);
$aka          = clean_str($body['aka']           ?? '', 200);
$type         = clean_str($body['type']          ?? 'unknown', 50);

// Derive initials (first two words)
$initials = '';
$words = preg_split('/\s+/', $authorName);
foreach (array_slice($words, 0, 2) as $w) {
    if ($w !== '') $initials .= strtoupper(substr($w, 0, 1));
}
if ($initials === '') $initials = '??';

// Server-side ID + timestamp — never trust the client for these
$req = [
    'id'          => 'req-' . time() . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
    'name'        => $name,
    'aka'         => $aka,
    'ra'          => $ra,
    'dec'         => $dec,
    'type'        => $type ?: 'unknown',
    'submittedAt' => gmdate('c'),
    'author'      => [
        'name'        => $authorName,
        'initials'    => $initials,
        'affiliation' => $affiliation,
    ],
    'justification' => $justification,
    'request'       => $equipment !== '' ? $equipment : '—',
    'timing'        => $timing,
    'status'        => 'pending',
];

$data = load_requests($DATA_FILE);
$data[] = $req;
if (!save_requests($DATA_FILE, $data)) {
    respond(500, ['error' => 'save failed — check that PHP can write to ' . basename($DATA_FILE)]);
}
respond(201, $req);
