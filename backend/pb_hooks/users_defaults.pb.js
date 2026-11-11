/// <reference path="../pb_data/types.d.ts" />
// People sign in by emailed code, so a user's password is never used. PocketBase
// still requires one; fill it in so staff can be created in the dashboard, or
// imported by script, with just an email.
onRecordCreateRequest((e) => {
  if (!e.record.getString('password')) {
    const pw = $security.randomString(32);
    e.record.set('password', pw);
    e.record.set('passwordConfirm', pw);
  }
  e.next();
}, 'users');
