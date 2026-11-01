"""Compare protected files to the hashes captured before the audit."""
import datetime, hashlib, json, pathlib, subprocess, sys

workspace, reference, data = map(pathlib.Path, sys.argv[1:])
checks = {}
for label, root, manifest in [
    ('workspace', workspace, 'workspace-initial-hashes.json'),
    ('reference', reference, 'reference-hashes.json'),
]:
    expected = json.loads((data / manifest).read_text())
    mismatches = []
    for name, digest in expected.items():
        path = root / name
        actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
        if actual != digest:
            mismatches.append({'path': name, 'expected': digest, 'actual': actual})
    current = {str(path.relative_to(root)) for folder in ['src', 'assets', 'scripts', 'tests', 'backup', 'dist']
               for path in (root / folder).rglob('*') if path.is_file() and 'resultados' not in path.parts}
    checks[label] = {'root': str(root), 'checkedFiles': len(expected), 'mismatches': mismatches,
                     'unexpectedProtectedFiles': sorted(current - expected.keys())}
status = subprocess.run(['git', 'status', '--short'], cwd=reference, capture_output=True, text=True)
checks['referenceGitStatus'] = {'exitCode': status.returncode, 'stdout': status.stdout, 'stderr': status.stderr}
checks['utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
(data / 'integrity-final.json').write_text(json.dumps(checks, indent=2) + '\n')
print(json.dumps(checks, indent=2))
assert not any(checks[label]['mismatches'] for label in ['workspace', 'reference'])
assert not any(checks[label]['unexpectedProtectedFiles'] for label in ['workspace', 'reference'])
assert status.returncode == 0 and not status.stdout.strip()
