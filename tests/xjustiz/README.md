# XJustiz schemas

The XSDs of [XJustiz](https://xjustiz.justiz.de) 3.6.2 that the ERV invitation message needs, unchanged
from the download "Schemata" of version 3.6.2 on the XJustiz website. `tests/xjustiz.ts` validates the
generated messages against them. They are test data only and not part of the app.

When the app moves to another XJustiz version, replace the folder with the files of that version
(`xjustiz_0005_nachrichten_*.xsd` and every file it includes) and update the versions in
`app/lib/erv/erv-invitation-message.ts`.
