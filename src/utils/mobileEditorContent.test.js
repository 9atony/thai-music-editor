import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeMobileTextRowHtml, resolveMobileTextRowHtml } from './mobileEditorContent.js';

test('mobile text rows escape user text and preserve line breaks', () => {
  assert.equal(
    escapeMobileTextRowHtml('ท่อน <A> & "B"\nบรรทัดสอง'),
    'ท่อน &lt;A&gt; &amp; &quot;B&quot;<br>บรรทัดสอง',
  );
});

test('opening and saving without edits preserves existing rich text markup', () => {
  assert.equal(
    resolveMobileTextRowHtml({
      originalHtml: '<b>ท่อนนำ</b><br><i>ช้า</i>',
      originalPlainText: 'ท่อนนำ\nช้า',
      draft: 'ท่อนนำ\nช้า',
    }),
    '<b>ท่อนนำ</b><br><i>ช้า</i>',
  );
});

test('edited mobile text becomes safe HTML instead of executable markup', () => {
  assert.equal(
    resolveMobileTextRowHtml({
      originalHtml: '<b>เดิม</b>',
      originalPlainText: 'เดิม',
      draft: '<img src=x onerror=alert(1)>',
    }),
    '&lt;img src=x onerror=alert(1)&gt;',
  );
});
