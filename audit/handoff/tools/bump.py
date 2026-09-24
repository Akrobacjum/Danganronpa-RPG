import sys, re, json
old, new = sys.argv[1], sys.argv[2]
def sub(path, pattern, repl, count=1):
    s = open(path, encoding='utf8').read()
    n = len(re.findall(pattern, s))
    assert n >= 1, (path, pattern)
    s = re.sub(pattern, repl, s, count=count)
    open(path, 'w', encoding='utf8').write(s)
sub('module.json', r'"version": "%s"' % re.escape(old), '"version": "%s"' % new)
sub('styles/danganronpa.css', r'--drpg-css-version: "%s"' % re.escape(old), '--drpg-css-version: "%s"' % new)
sub('README.md', r'They describe version [0-9.]+\.', 'They describe version %s.' % new)
for f in ['gm-handbook.en','gm-handbook.pl','player-handbook.en','player-handbook.pl','player-brochure.en','player-brochure.pl']:
    p = f'docs/handbooks/{f}.md'
    L = open(p, encoding='utf8').read().split('\n')
    for i in range(5):
        if re.search(r'\d+\.\d+\.\d+', L[i]):
            L[i] = re.sub(r'\d+\.\d+\.\d+', new, L[i], count=1); break
    else:
        raise SystemExit('no stamp in ' + p)
    open(p, 'w', encoding='utf8').write('\n'.join(L))
print(json.load(open('module.json'))['version'])
