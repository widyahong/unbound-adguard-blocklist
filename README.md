# Unbound AdGuard Blocklist (auto-update)

This repo automatically downloads the [AdGuard DNS filter](https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt),
converts it into `unbound.conf` format (`local-zone ... always_nxdomain`),
and commits the result (`adguard-dns.conf`) back to the repo — run automatically
every day via GitHub Actions.

> This project is not affiliated with or endorsed by NLnet Labs (the maintainers
> of Unbound) or AdGuard. It simply converts AdGuard's publicly available,
> GPL-3.0-licensed DNS filter into a format Unbound can consume.

## Structure

```
.
├── .github/workflows/update-blocklist.yml   # automated workflow
├── scripts/convert.js                       # conversion logic
└── adguard-dns.conf                         # generated/updated automatically
```

## On your unbound server

Download `adguard-dns.conf` from this repo (e.g. via `curl` in a server cron
job, or `git pull` if the server clones this repo directly), save it to
`/etc/unbound/adguard-dns.conf`, then add this to your main `unbound.conf`:

```
server:
    include: "/etc/unbound/adguard-dns.conf"
```

Check the config and restart:

```bash
unbound-checkconf
systemctl restart unbound
```

### Tip: auto-sync on the server

If you also want your server to automatically pull the latest update from
this repo, you can set up a simple cron job on the server, for example:

```bash
# /etc/cron.d/unbound-blocklist-sync
0 8 * * * root curl -sSL -o /etc/unbound/adguard-dns.conf \
  https://raw.githubusercontent.com/widyahong/unbound-adguard-blocklist/main/adguard-dns.conf \
  && unbound-checkconf && systemctl restart unbound
```

## License

The generated `adguard-dns.conf` is derived from AdGuard's DNS filter, which
is licensed under [GPL-3.0](https://github.com/AdguardTeam/AdGuardSDNSFilter/blob/master/LICENSE).
This repo is licensed under GPL-3.0 as well to stay consistent with the
upstream source.
