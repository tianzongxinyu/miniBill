import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchToggleVisible,
  resolveApiTagMatch,
  resolveUiTagMatch,
  shouldResetTagMatch,
} from './searchFilterMatch.ts';

describe('searchFilterMatch', () => {
  it('shows toggle only when live conditions >= 2', () => {
    assert.equal(matchToggleVisible(0), false);
    assert.equal(matchToggleVisible(1), false);
    assert.equal(matchToggleVisible(2), true);
  });

  it('resets match only when live conditions drop below 2', () => {
    assert.equal(shouldResetTagMatch(1), true);
    assert.equal(shouldResetTagMatch(2), false);
  });

  it('keeps UI any while live >= 2 even if settled is still 1', () => {
    assert.equal(resolveUiTagMatch(2, 'any'), 'any');
    assert.equal(resolveUiTagMatch(1, 'any'), 'all');
  });

  it('sends any to API only when settled >= 2', () => {
    assert.equal(resolveApiTagMatch(1, 'any'), 'all');
    assert.equal(resolveApiTagMatch(2, 'any'), 'any');
    assert.equal(resolveApiTagMatch(2, 'all'), 'all');
  });
});
