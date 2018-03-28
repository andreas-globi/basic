<?php
require_once __DIR__ . '/basic.php';

$redis = new \Redis();
$redis->connect('127.0.0.1', 6379);

// We need a file argument
if (!isset($argv[1])) {
	echo "\033[0;32mUsage: php basic.php <file>\n";
	echo "\tWhere <file> is the BASIC file to parse\n\033[0m";
} else {
	// Get the file
	$source = file_get_contents($argv[1]);

	// Create a new parser
	$basic = new Basic();
	$basic->preinterpret($source);
    $canContinue = true;
    while($canContinue) {
        $canContinue = $basic->interpretStatement();
        $basic->saveState($redis, 0, true);
    }
}
