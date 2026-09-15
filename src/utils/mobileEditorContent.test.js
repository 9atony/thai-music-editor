import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeMobileLabel, escapeMobileTextRowHtml, getMobileTextTarget, resolveMobileTextRowHtml } from './mobileEditorContent.js';

test('mobile text rows escape user text and preserve line breaks', () => {
  assert.equal(
    escapeMobileTextRowHtml('ท่อน <A> & "B"\nบรรทัดสอง'),
    'ท่อน &lt;A&gt; &amp; &quot;B&quot;<br>บรรทัดสอง',
  );
});

test('mobile row labels remain plain and single-line', () => {
  assert.equal(escapeMobileLabel('มือขวา <หลัก>\nต่อ'), 'มือขวา &lt;หลัก&gt; ต่อ');
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

test('mobile text targets return content instead of structural span markers', () => {
  assert.deepEqual(
    getMobileTextTarget({ rowType: 'single', row: [["@TEXT_SPAN_4", '<b>ข้อความ</b>']] }),
    { kind: 'measure', html: '<b>ข้อความ</b>' },
  );
  assert.deepEqual(
    getMobileTextTarget({ rowType: 'annotation', row: [['คำอธิบาย'], ['@HIDDEN']], measureIndex: 0 }),
    { kind: 'annotation', html: 'คำอธิบาย' },
  );
  assert.deepEqual(
    getMobileTextTarget({ rowType: 'annotation', row: [['@TEXT_SPAN_8', 'คำอธิบายยาว']] }),
    { kind: 'annotation', html: 'คำอธิบายยาว' },
  );
  assert.equal(
    getMobileTextTarget({ rowType: 'annotation', row: [['คำอธิบาย'], ['@HIDDEN']], measureIndex: 1 }),
    null,
  );
});
