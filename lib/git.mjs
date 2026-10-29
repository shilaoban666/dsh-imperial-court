// 隔离：每份奏折在原仓库的一个 git worktree 里办差（分支 court/<奏折编号>），
// 批红时合并回开朝时的分支，驳回 / 丢弃时整枝删掉，原目录在批红之前一个字节都不动。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_PATCH = 400 * 1024;

function git(cwd, args, { allowFail = false } = {}) {
  const res = spawnSync('git', args, {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) {
    if (allowFail) return { ok: false, out: '', err: res.error.message };
    throw new Error(`git ${args[0]}: ${res.error.message}`);
  }
  const out = String(res.stdout || '').replace(/\s+$/, '');
  const err = String(res.stderr || '').trim();
  if (res.status !== 0 && !allowFail) throw new Error(`git ${args[0]}: ${err || out || `exit ${res.status}`}`);
  return { ok: res.status === 0, out, err, status: res.status };
}

export const branchOf = edictId => `court/${edictId}`;

/**
 * 工作目录所在仓库的信息；不是仓库返回 null。
 * @returns {null | { root, rel, head, base, dirty }}  head 为空表示还没有提交
 */
export function repoInfo(dir) {
  const top = git(dir, ['rev-parse', '--show-toplevel'], { allowFail: true });
  if (!top.ok || !top.out) return null;
  const root = path.resolve(top.out);
  const head = git(root, ['rev-parse', '--verify', '-q', 'HEAD'], { allowFail: true });
  const branch = git(root, ['symbolic-ref', '--short', '-q', 'HEAD'], { allowFail: true });
  const status = git(root, ['status', '--porcelain'], { allowFail: true });
  return {
    root,
    rel: path.relative(root, path.resolve(dir)),
    head: head.ok ? head.out : '',
    base: branch.ok ? branch.out : '',
    dirty: Boolean(status.out),
  };
}

/** 建 worktree：<dir>，新分支 court/<id>，从开朝时的 HEAD 拉出 */
export function createWorktree(info, edictId, dir) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const branch = branchOf(edictId);
  git(info.root, ['worktree', 'add', '-b', branch, dir, info.head]);
  return { branch, worktree: dir, execDir: info.rel ? path.join(dir, info.rel) : dir };
}

function identityArgs(cwd) {
  const email = git(cwd, ['config', 'user.email'], { allowFail: true });
  // 没配身份时 commit 会失败；用朝堂自己的署名兜底，不改用户的全局配置
  return email.ok && email.out ? [] : ['-c', 'user.name=Sansheng Court', '-c', 'user.email=court@localhost'];
}

/** 把 worktree 里的改动提交到分支；没有改动返回 '' */
export function commitAll(worktree, message) {
  git(worktree, ['add', '-A']);
  const staged = git(worktree, ['diff', '--cached', '--quiet'], { allowFail: true });
  if (staged.ok) return '';
  git(worktree, [...identityArgs(worktree), 'commit', '-q', '-m', message]);
  return git(worktree, ['rev-parse', 'HEAD']).out;
}

/** 开朝时的提交到分支末端的改动：文件清单 + 补丁（补丁过大截断） */
export function diffSummary(root, from, branch) {
  const range = `${from}..${branch}`;
  const numstat = git(root, ['diff', '--numstat', range], { allowFail: true }).out;
  const files = numstat ? numstat.split('\n').map(line => {
    const [add, del, ...rest] = line.split('\t');
    return { file: rest.join('\t'), add: add === '-' ? 0 : Number(add) || 0, del: del === '-' ? 0 : Number(del) || 0, binary: add === '-' };
  }) : [];
  let patch = git(root, ['diff', range], { allowFail: true }).out;
  if (patch.length > MAX_PATCH) patch = `${patch.slice(0, MAX_PATCH)}\n\n… (truncated)\n`;
  return {
    files,
    insertions: files.reduce((sum, item) => sum + item.add, 0),
    deletions: files.reduce((sum, item) => sum + item.del, 0),
    patch,
  };
}

/** 工作区里改动 / 新增的文件（相对仓库根） */
export function statusFiles(dir) {
  const res = git(dir, ['status', '--porcelain', '-uall'], { allowFail: true });
  if (!res.ok) return [];
  return res.out.split('\n').filter(Boolean).map(line => line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
}

/** worktree 相对开朝时的提交改了多少（含未提交、未跟踪的文件） */
export function worktreeNumstat(dir, base) {
  git(dir, ['add', '-A', '--intent-to-add'], { allowFail: true });
  const res = git(dir, ['diff', '--numstat', base], { allowFail: true });
  if (!res.ok || !res.out) return [];
  return res.out.split('\n').map(line => {
    const [add, del, ...rest] = line.split('\t');
    return { file: rest.join('\t'), add: add === '-' ? 0 : Number(add) || 0, del: del === '-' ? 0 : Number(del) || 0, binary: add === '-' };
  });
}

export function worktreeDiff(dir, base, rel) {
  git(dir, ['add', '-A', '--intent-to-add'], { allowFail: true });
  return git(dir, ['diff', base, '--', rel], { allowFail: true }).out;
}

export function diffFile(root, from, to, rel) {
  return git(root, ['diff', `${from}..${to}`, '--', rel], { allowFail: true }).out;
}

/** 分支上某个文件的内容；不存在返回 null */
export function showFile(root, ref, rel) {
  const res = git(root, ['show', `${ref}:${String(rel).replace(/\\/g, '/')}`], { allowFail: true });
  return res.ok ? res.out : null;
}

export function removeWorktree(root, dir) {
  git(root, ['worktree', 'remove', '--force', dir], { allowFail: true });
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  git(root, ['worktree', 'prune'], { allowFail: true });
}

export function deleteBranch(root, branch, force = false) {
  return git(root, ['branch', force ? '-D' : '-d', branch], { allowFail: true }).ok;
}

export function branchExists(root, branch) {
  return git(root, ['rev-parse', '--verify', '-q', `refs/heads/${branch}`], { allowFail: true }).ok;
}

export function currentBranch(root) {
  const res = git(root, ['symbolic-ref', '--short', '-q', 'HEAD'], { allowFail: true });
  return res.ok ? res.out : '';
}

/**
 * 在原仓库把分支合并进当前分支（必须正是开朝时的分支）。失败就 merge --abort，原仓库保持原样。
 * @returns {{ ok: true, commit } | { ok: false, reason: 'wrong-branch'|'detached'|'failed', current?, error? }}
 */
export function mergeBranch(root, base, branch, message) {
  if (!base) return { ok: false, reason: 'detached' };
  const current = currentBranch(root);
  if (current !== base) return { ok: false, reason: 'wrong-branch', current: current || 'HEAD' };
  const res = git(root, [...identityArgs(root), 'merge', '--no-ff', '--no-edit', '-m', message, branch], { allowFail: true });
  if (!res.ok) {
    git(root, ['merge', '--abort'], { allowFail: true });
    return { ok: false, reason: 'failed', error: (res.err || res.out).split('\n').slice(-6).join('\n') };
  }
  return { ok: true, commit: git(root, ['rev-parse', 'HEAD']).out };
}
