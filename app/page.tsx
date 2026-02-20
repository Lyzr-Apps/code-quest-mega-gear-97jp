'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import {
  FiCpu, FiDatabase, FiLayers, FiHash, FiGitBranch, FiTerminal,
  FiZap, FiType, FiFile, FiAward, FiStar, FiShield, FiTrendingUp,
  FiActivity, FiTarget, FiFlag, FiLock, FiCheck, FiChevronRight,
  FiChevronLeft, FiMessageSquare, FiSend, FiCode, FiBookOpen,
  FiMenu, FiX, FiPlay, FiRefreshCw, FiArrowRight, FiHome,
  FiMap, FiHelpCircle
} from 'react-icons/fi'
import { HiOutlineFire } from 'react-icons/hi'
import { RiGamepadLine } from 'react-icons/ri'

// ─── Agent IDs ────────────────────────────────────────────────────
const TUTOR_AGENT_ID = '6997f9b4203926f2a9800b9e'
const EVALUATOR_AGENT_ID = '6997f9b42ec22406b8d061f1'
const XP_PER_LEVEL = 500

// ─── Icon Map ─────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  FiCpu, FiDatabase, FiLayers, FiHash, FiGitBranch, FiTerminal,
  FiZap, FiType, FiFile, FiAward, FiStar, FiShield, FiTrendingUp,
  FiActivity, FiTarget, FiFlag, FiLock, FiCheck,
}

function getIcon(name: string, cls?: string) {
  const I = ICON_MAP[name]
  return I ? <I className={cls} /> : <FiCode className={cls} />
}

// ─── Safe JSON Parser ─────────────────────────────────────────────
function safeParseResult(result: unknown): Record<string, unknown> {
  if (typeof result === 'string') {
    try { return JSON.parse(result) } catch { return { text: result } }
  }
  return (result as Record<string, unknown>) || {}
}

// ─── XP Helpers ───────────────────────────────────────────────────
const calcLevel = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1
const xpProgress = (xp: number) => ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100
const xpToNext = (xp: number) => XP_PER_LEVEL - (xp % XP_PER_LEVEL)

// ─── Data Models ──────────────────────────────────────────────────
const MODULES = [
  { id: 1, title: 'Registers 101', desc: 'Learn about x86 registers (EAX, EBX, ECX, EDX, ESP, EBP, ESI, EDI)', icon: 'FiCpu', xp: 100 },
  { id: 2, title: 'Memory & Addressing', desc: 'Understanding memory addressing modes and MOV instruction', icon: 'FiDatabase', xp: 150 },
  { id: 3, title: 'Stack Operations', desc: 'Master PUSH, POP, and stack frame management', icon: 'FiLayers', xp: 150 },
  { id: 4, title: 'Arithmetic & Logic', desc: 'ADD, SUB, MUL, DIV, AND, OR, XOR operations', icon: 'FiHash', xp: 200 },
  { id: 5, title: 'Control Flow & Jumps', desc: 'CMP, JMP, JE, JNE, JG, JL and conditional branching', icon: 'FiGitBranch', xp: 200 },
  { id: 6, title: 'Procedures & Calling', desc: 'CALL, RET, calling conventions, and stack frames', icon: 'FiTerminal', xp: 250 },
  { id: 7, title: 'Interrupts & Syscalls', desc: 'INT 0x80, system calls, and OS interaction', icon: 'FiZap', xp: 250 },
  { id: 8, title: 'String Operations', desc: 'MOVS, CMPS, SCAS, REP prefix and string handling', icon: 'FiType', xp: 200 },
  { id: 9, title: 'File I/O', desc: 'Reading and writing files using system calls', icon: 'FiFile', xp: 250 },
  { id: 10, title: 'Capstone: Complete Program', desc: 'Build a full x86 Assembly program from scratch', icon: 'FiAward', xp: 500 },
]

const CONCEPTS: Record<number, { title: string; content: string; visual: string }[]> = {
  1: [
    { title: 'What is a Register?', content: 'Registers are small, ultra-fast storage locations inside the CPU. Think of them as the CPU\'s scratchpad \u2014 variables that the processor can access instantly without going to memory.', visual: 'register-diagram' },
    { title: 'General Purpose Registers', content: 'x86 has 8 general-purpose 32-bit registers: EAX (accumulator), EBX (base), ECX (counter), EDX (data), ESI (source index), EDI (destination index), EBP (base pointer), ESP (stack pointer).', visual: 'register-list' },
    { title: 'The MOV Instruction', content: 'MOV is the most fundamental instruction. It copies data from source to destination.\nSyntax: MOV destination, source\nExample: MOV EAX, 42 puts 42 into EAX.\nMOV EBX, EAX copies EAX into EBX.', visual: 'mov-flow' },
  ],
  2: [
    { title: 'Memory Layout', content: 'Memory is a vast array of bytes, each with a unique address. Programs have sections: .text (code), .data (initialized data), .bss (uninitialized data), and the stack.', visual: 'memory-layout' },
    { title: 'Addressing Modes', content: 'Direct: MOV EAX, [0x1000]\nRegister indirect: MOV EAX, [EBX]\nIndexed: MOV EAX, [EBX+ECX*4]\nThese let you work with arrays and structures.', visual: 'addressing-modes' },
    { title: 'LEA Instruction', content: 'LEA (Load Effective Address) calculates an address without accessing memory.\nLEA EAX, [EBX+ECX*4+8] computes the address and stores it in EAX.\nUseful for pointer arithmetic.', visual: 'lea-diagram' },
  ],
  3: [
    { title: 'The Stack', content: 'The stack is LIFO (Last In, First Out). ESP always points to the top. The stack grows downward \u2014 PUSH decrements ESP, POP increments it.', visual: 'stack-diagram' },
    { title: 'PUSH and POP', content: 'PUSH EAX: ESP = ESP - 4, store EAX at [ESP].\nPOP EBX: read [ESP] into EBX, ESP = ESP + 4.\nThe stack is your temporary workspace.', visual: 'push-pop' },
    { title: 'Stack Frames', content: 'Prologue: PUSH EBP; MOV EBP, ESP\nEpilogue: MOV ESP, EBP; POP EBP; RET\nLocals: [EBP-4], [EBP-8]\nParams: [EBP+8], [EBP+12]', visual: 'stack-frame' },
  ],
  4: [
    { title: 'ADD and SUB', content: 'ADD EAX, EBX adds EBX to EAX.\nSUB EAX, 10 subtracts 10 from EAX.\nBoth set CPU flags (Zero, Carry, Overflow).', visual: 'add-sub' },
    { title: 'MUL and DIV', content: 'MUL EBX multiplies EAX by EBX, result in EDX:EAX.\nDIV EBX divides EDX:EAX by EBX.\nAlways XOR EDX, EDX before unsigned division.', visual: 'mul-div' },
  ],
  5: [
    { title: 'CMP and Flags', content: 'CMP EAX, EBX subtracts EBX from EAX but only sets flags.\nZF=1 if equal. CF and SF indicate greater/less than.', visual: 'cmp-flags' },
    { title: 'Conditional Jumps', content: 'JE (equal), JNE (not equal), JG (greater, signed), JL (less, signed), JA (above, unsigned), JB (below, unsigned).\nThese create if-then-else logic.', visual: 'jumps' },
  ],
  6: [
    { title: 'CALL and RET', content: 'CALL pushes the return address and jumps to the function.\nRET pops the return address and jumps back.', visual: 'call-ret' },
    { title: 'Calling Conventions', content: 'cdecl: params pushed right-to-left, caller cleans stack.\nReturn value in EAX.\nCallee preserves EBX, ESI, EDI, EBP, ESP.', visual: 'convention' },
  ],
  7: [
    { title: 'INT 0x80', content: 'INT 0x80 triggers a Linux system call.\nEAX = syscall number, EBX/ECX/EDX = arguments.\nsys_write=4, sys_exit=1, sys_read=3.', visual: 'int80' },
    { title: 'Common System Calls', content: 'sys_exit (1): Exit program.\nsys_read (3): Read input.\nsys_write (4): Write output.\nsys_open (5): Open file.\nsys_close (6): Close file.', visual: 'syscalls' },
  ],
  8: [
    { title: 'String Instructions', content: 'MOVSB/MOVSW/MOVSD copies from [ESI] to [EDI].\nCMPSB compares strings. SCASB scans for a value.\nCLD for forward, STD for backward.', visual: 'string-ops' },
    { title: 'REP Prefix', content: 'REP repeats ECX times.\nREP MOVSB copies ECX bytes.\nREPE CMPSB compares until mismatch.\nREPNE SCASB scans until match.', visual: 'rep-prefix' },
  ],
  9: [
    { title: 'File Operations', content: 'Open: EAX=5, EBX=filename, ECX=flags, EDX=mode.\nRead: EAX=3, EBX=fd, ECX=buffer, EDX=count.\nWrite: EAX=4, same pattern.\nAll via INT 0x80.', visual: 'file-io' },
    { title: 'File Descriptors', content: 'Stdin=0, Stdout=1, Stderr=2.\nOpened files get fd 3+.\nUse the fd for all read/write/close operations.', visual: 'file-desc' },
  ],
  10: [
    { title: 'Program Structure', content: 'A complete program needs:\nsection .data (strings)\nsection .bss (buffers)\nsection .text with global _start\n_start is the entry point.', visual: 'program-struct' },
    { title: 'Putting It All Together', content: 'Combine registers, memory, stack, arithmetic, control flow, procedures, and syscalls.\nAssemble: nasm -f elf32 prog.asm\nLink: ld -m elf_i386 prog.o -o prog', visual: 'build-chain' },
  ],
}

const CHALLENGES: Record<number, { id: string; prompt: string; difficulty: string; xp: number }[]> = {
  1: [
    { id: 'c1_1', prompt: 'Write x86 Assembly instructions to:\n1. Move the value 42 into EAX\n2. Copy EAX into EBX\n3. Move the value 100 into ECX', difficulty: 'Beginner', xp: 50 },
    { id: 'c1_2', prompt: 'Swap the values of EAX and EBX using ECX as a temp register.\nAssume EAX=10 and EBX=20.', difficulty: 'Beginner', xp: 50 },
  ],
  2: [{ id: 'c2_1', prompt: 'Write instructions to:\n1. Load the value at memory address in EBX into EAX\n2. Store 255 at the address in ECX', difficulty: 'Intermediate', xp: 75 }],
  3: [{ id: 'c3_1', prompt: 'Push 10, 20, 30 onto the stack, then pop them into EAX, EBX, ECX.\nRemember LIFO order!', difficulty: 'Intermediate', xp: 75 }],
  4: [{ id: 'c4_1', prompt: 'Move 15 into EAX and 27 into EBX.\nAdd EBX to EAX, then subtract 10 from EAX.', difficulty: 'Intermediate', xp: 75 }],
  5: [{ id: 'c5_1', prompt: 'Compare EAX and EBX. If EAX > EBX, jump to "greater".\nOtherwise jump to "less_or_equal".\nInclude both labels with NOP.', difficulty: 'Intermediate', xp: 100 }],
  6: [{ id: 'c6_1', prompt: 'Write function "add_numbers":\n1. Set up stack frame\n2. Read params from [EBP+8] and [EBP+12]\n3. Add them, result in EAX\n4. Clean up and return', difficulty: 'Advanced', xp: 100 }],
  7: [{ id: 'c7_1', prompt: 'Write Linux x86 Assembly to print "Hello" to stdout.\nUse INT 0x80 with sys_write (EAX=4, EBX=1).', difficulty: 'Advanced', xp: 100 }],
  8: [{ id: 'c8_1', prompt: 'Use REP MOVSB to copy 10 bytes from ESI to EDI.\nSet ECX to count and use CLD first.', difficulty: 'Advanced', xp: 100 }],
  9: [{ id: 'c9_1', prompt: 'Open "output.txt" for writing using sys_open.\nEAX=5, flags=0x41 (O_WRONLY|O_CREAT), mode=0644.\nStore the file descriptor.', difficulty: 'Advanced', xp: 100 }],
  10: [{ id: 'c10_1', prompt: 'Write a complete x86 Linux program:\n1. Define "Assembly Quest Complete!" in .data\n2. Print it with sys_write (EAX=4)\n3. Exit with sys_exit (EAX=1), code 0\nInclude sections and _start.', difficulty: 'Capstone', xp: 200 }],
}

const ACHIEVEMENTS = [
  { id: 'first_step', title: 'First Step', desc: 'Complete your first module', icon: 'FiFlag', modReq: 1 },
  { id: 'register_master', title: 'Register Master', desc: 'Complete Registers 101', icon: 'FiCpu', modReq: 1 },
  { id: 'memory_walker', title: 'Memory Walker', desc: 'Complete Memory & Addressing', icon: 'FiDatabase', modReq: 2 },
  { id: 'stack_overflow', title: 'Stack Overflow', desc: 'Complete Stack Operations', icon: 'FiLayers', modReq: 3 },
  { id: 'math_wizard', title: 'Math Wizard', desc: 'Complete Arithmetic & Logic', icon: 'FiHash', modReq: 4 },
  { id: 'flow_ctrl', title: 'Flow Controller', desc: 'Complete Control Flow', icon: 'FiGitBranch', modReq: 5 },
  { id: 'proc_pro', title: 'Procedure Pro', desc: 'Complete Procedures', icon: 'FiTerminal', modReq: 6 },
  { id: 'sys_hacker', title: 'System Hacker', desc: 'Complete Interrupts', icon: 'FiZap', modReq: 7 },
  { id: 'string_th', title: 'String Theory', desc: 'Complete String Ops', icon: 'FiType', modReq: 8 },
  { id: 'io_master', title: 'I/O Master', desc: 'Complete File I/O', icon: 'FiFile', modReq: 9 },
  { id: 'asm_master', title: 'Assembly Master', desc: 'Complete the Capstone', icon: 'FiAward', modReq: 10 },
  { id: 'xp500', title: 'Rising Star', desc: 'Earn 500 XP', icon: 'FiStar', xpReq: 500 },
  { id: 'xp1000', title: 'Veteran', desc: 'Earn 1000 XP', icon: 'FiShield', xpReq: 1000 },
  { id: 'xp2000', title: 'Legend', desc: 'Earn 2000 XP', icon: 'FiTrendingUp', xpReq: 2000 },
  { id: 'perfect', title: 'Perfectionist', desc: 'Score 100% on a challenge', icon: 'FiTarget' },
]

const REG_GAME = [
  { value: 'Accumulator', reg: 'EAX' },
  { value: 'Base', reg: 'EBX' },
  { value: 'Counter', reg: 'ECX' },
  { value: 'Data', reg: 'EDX' },
  { value: 'Stack Pointer', reg: 'ESP' },
  { value: 'Base Pointer', reg: 'EBP' },
]

// ─── Types ────────────────────────────────────────────────────────
interface ChatMsg { role: 'user' | 'tutor'; text: string; code?: string; analogy?: string; followUps?: string[] }
interface EvalData { is_correct: boolean; score: number; xp_awarded: number; feedback: string; what_code_does: string; what_was_expected: string; errors: string[]; hints: string[]; pass_fail: string }
type Screen = 'dashboard' | 'module' | 'challenge' | 'achievements'

// ─── LocalStorage ─────────────────────────────────────────────────
function loadSave() {
  if (typeof window === 'undefined') return null
  try { const s = localStorage.getItem('aq_save'); return s ? JSON.parse(s) : null } catch { return null }
}
function writeSave(d: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('aq_save', JSON.stringify(d)) } catch { /* noop */ }
}

// ═══════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AssemblyQuestPage() {
  // Navigation
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [sidebar, setSidebar] = useState(true)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [modId, setModId] = useState(1)
  const [chIdx, setChIdx] = useState(0)

  // Game state
  const [xp, setXp] = useState(0)
  const [doneMods, setDoneMods] = useState<number[]>([])
  const [doneCh, setDoneCh] = useState<string[]>([])
  const [streak, setStreak] = useState(1)
  const [xpAnim, setXpAnim] = useState(false)

  // Tutor
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [chatIn, setChatIn] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)

  // Challenge
  const [code, setCode] = useState('')
  const [evalRes, setEvalRes] = useState<EvalData | null>(null)
  const [evalBusy, setEvalBusy] = useState(false)
  const [hintsShown, setHintsShown] = useState(0)

  // Mini-game
  const [gameSel, setGameSel] = useState<string | null>(null)
  const [gamePlaced, setGamePlaced] = useState<Record<string, string>>({})
  const [gameDone, setGameDone] = useState(false)

  // Concept
  const [cIdx, setCIdx] = useState(0)

  // Hydration
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const s = loadSave()
    if (s) { setXp(s.xp || 0); setDoneMods(s.doneMods || []); setDoneCh(s.doneCh || []); setStreak(s.streak || 1) }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    writeSave({ xp, doneMods, doneCh, streak })
  }, [xp, doneMods, doneCh, streak, ready])

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Derived
  const level = calcLevel(xp)
  const prog = xpProgress(xp)
  const toNext = xpToNext(xp)
  const mod = MODULES.find(m => m.id === modId)!
  const concepts = CONCEPTS[modId] || []
  const challenges = CHALLENGES[modId] || []
  const curCh = challenges[chIdx]
  const unlocked = useCallback((id: number) => id === 1 || doneMods.includes(id - 1), [doneMods])
  const completed = useCallback((id: number) => doneMods.includes(id), [doneMods])

  const earned = useMemo(() => ACHIEVEMENTS.filter(a => {
    if ((a as any).modReq && doneMods.includes((a as any).modReq)) return true
    if ((a as any).xpReq && xp >= (a as any).xpReq) return true
    return false
  }).map(a => a.id), [doneMods, xp])

  // Actions
  const addXp = useCallback((n: number) => { setXpAnim(true); setXp(p => p + n); setTimeout(() => setXpAnim(false), 1500) }, [])

  const goModule = useCallback((id: number) => {
    if (!unlocked(id)) return
    setModId(id); setCIdx(0); setGameDone(false); setGameSel(null); setGamePlaced({}); setScreen('module')
  }, [unlocked])

  const goChallenge = useCallback((mid: number, ci = 0) => {
    setModId(mid); setChIdx(ci); setCode(''); setEvalRes(null); setHintsShown(0); setScreen('challenge')
  }, [])

  // Tutor chat
  const sendTutor = useCallback(async (msg: string) => {
    if (!msg.trim() || chatBusy) return
    setMsgs(p => [...p, { role: 'user', text: msg }])
    setChatIn('')
    setChatBusy(true)
    try {
      const r = await callAIAgent(`[Module: ${mod.title}] ${msg}`, TUTOR_AGENT_ID)
      if (r.success) {
        const d = safeParseResult(r.response?.result)
        setMsgs(p => [...p, {
          role: 'tutor',
          text: (d.explanation as string) || (d.text as string) || r.response?.message || 'Let me help with that!',
          code: (d.code_example as string) || '',
          analogy: (d.analogy as string) || '',
          followUps: Array.isArray(d.follow_up_questions) ? d.follow_up_questions as string[] : [],
        }])
      } else {
        setMsgs(p => [...p, { role: 'tutor', text: 'Sorry, I had trouble with that. Please try again.' }])
      }
    } catch {
      setMsgs(p => [...p, { role: 'tutor', text: 'Connection error. Please try again.' }])
    }
    setChatBusy(false)
  }, [chatBusy, mod.title])

  // Challenge submit
  const submitCode = useCallback(async () => {
    if (!code.trim() || evalBusy || !curCh) return
    setEvalBusy(true); setEvalRes(null)
    try {
      const prompt = `Challenge: ${curCh.prompt}\n\nUser's submitted code:\n\`\`\`asm\n${code}\n\`\`\`\n\nEvaluate this submission for correctness.`
      const r = await callAIAgent(prompt, EVALUATOR_AGENT_ID)
      if (r.success) {
        const d = safeParseResult(r.response?.result)
        const ev: EvalData = {
          is_correct: d.is_correct === true,
          score: typeof d.score === 'number' ? d.score : 0,
          xp_awarded: typeof d.xp_awarded === 'number' ? d.xp_awarded : 0,
          feedback: (d.feedback as string) || '',
          what_code_does: (d.what_code_does as string) || '',
          what_was_expected: (d.what_was_expected as string) || '',
          errors: Array.isArray(d.errors) ? d.errors as string[] : [],
          hints: Array.isArray(d.hints) ? d.hints as string[] : [],
          pass_fail: (d.pass_fail as string) || 'FAIL',
        }
        setEvalRes(ev)
        if (ev.pass_fail === 'PASS' || ev.is_correct) {
          addXp(ev.xp_awarded || curCh.xp)
          if (!doneCh.includes(curCh.id)) {
            const nc = [...doneCh, curCh.id]
            setDoneCh(nc)
            const allDone = (CHALLENGES[modId] || []).every(c => nc.includes(c.id))
            if (allDone && !doneMods.includes(modId)) setDoneMods(p => [...p, modId])
          }
        }
      } else {
        setEvalRes({ is_correct: false, score: 0, xp_awarded: 0, feedback: 'Evaluation failed. Try again.', what_code_does: '', what_was_expected: '', errors: ['Service unavailable'], hints: [], pass_fail: 'FAIL' })
      }
    } catch {
      setEvalRes({ is_correct: false, score: 0, xp_awarded: 0, feedback: 'Connection error.', what_code_does: '', what_was_expected: '', errors: ['Network error'], hints: [], pass_fail: 'FAIL' })
    }
    setEvalBusy(false)
  }, [code, evalBusy, curCh, modId, doneCh, doneMods, addXp])

  // Mini-game
  const gameClick = useCallback((item: string) => {
    if (gameDone) return
    if (gameSel === item) { setGameSel(null); return }
    if (gameSel) {
      const isReg = REG_GAME.some(g => g.reg === item)
      const isVal = REG_GAME.some(g => g.value === gameSel)
      if (isReg && isVal) {
        const np = { ...gamePlaced, [item]: gameSel }
        setGamePlaced(np); setGameSel(null)
        if (REG_GAME.every(g => np[g.reg] === g.value)) setGameDone(true)
      } else { setGameSel(item) }
    } else { setGameSel(item) }
  }, [gameSel, gamePlaced, gameDone])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FiCpu className="w-12 h-12 text-[hsl(180,100%,50%)] mx-auto animate-pulse" />
          <p className="mt-4 text-[hsl(180,100%,70%)] font-mono tracking-wider text-sm">Loading Assembly Quest...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ═══ SIDEBAR ═══ */}
      <aside className={`${sidebar ? 'w-56' : 'w-14'} transition-all duration-300 flex flex-col border-r border-[hsl(180,60%,30%)] bg-[hsl(260,28%,7%)] shrink-0 z-20`}>
        <div className="p-3 flex items-center gap-2 border-b border-[hsl(180,50%,25%)]">
          <button onClick={() => setSidebar(!sidebar)} className="p-1.5 rounded hover:bg-[hsl(260,20%,15%)] text-[hsl(180,100%,70%)] transition-colors">
            {sidebar ? <FiChevronLeft size={16} /> : <FiMenu size={16} />}
          </button>
          {sidebar && <h1 className="text-xs font-bold tracking-widest text-[hsl(180,100%,50%)] neon-glow truncate">ASSEMBLY QUEST</h1>}
        </div>
        <nav className="flex-1 py-2 px-1.5 space-y-0.5">
          {([
            { s: 'dashboard' as Screen, icon: FiHome, label: 'Dashboard' },
            { s: 'module' as Screen, icon: FiMap, label: 'Learning Path' },
            { s: 'achievements' as Screen, icon: FiAward, label: 'Achievements' },
          ]).map(n => (
            <button key={n.s} onClick={() => { if (n.s === 'module') goModule(modId); else setScreen(n.s) }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-all ${screen === n.s ? 'bg-[hsl(180,100%,50%,0.12)] text-[hsl(180,100%,50%)] neon-border' : 'text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,12%)]'}`}>
              <n.icon size={16} />
              {sidebar && <span className="truncate">{n.label}</span>}
            </button>
          ))}
        </nav>
        {sidebar && (
          <div className="p-2.5 border-t border-[hsl(180,50%,25%)]">
            <div className="glass-card rounded p-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <HiOutlineFire className="text-[hsl(30,100%,50%)]" size={14} />
                <span className="text-[10px] text-[hsl(180,50%,45%)]">Streak</span>
              </div>
              <p className="text-base font-bold text-[hsl(60,100%,50%)]">{streak} day{streak !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 border-b border-[hsl(180,60%,30%)] bg-[hsl(260,28%,7%,0.9)] backdrop-blur flex items-center px-4 gap-3 shrink-0 z-10">
          <div className="flex items-center gap-1.5 text-[10px] text-[hsl(180,50%,45%)]">
            <FiCode size={12} /><span>AQ</span>
            {screen !== 'dashboard' && <><FiChevronRight size={10} /><span className="text-[hsl(180,100%,70%)]">{screen === 'module' ? mod.title : screen === 'challenge' ? `Challenge` : 'Achievements'}</span></>}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full border-2 border-[hsl(300,80%,50%)] flex items-center justify-center text-[10px] font-bold text-[hsl(300,80%,50%)] ${xpAnim ? 'animate-bounce' : ''}`}>{level}</div>
            <div className="w-28">
              <div className="flex justify-between text-[9px] text-[hsl(180,50%,45%)] mb-0.5">
                <span>{xp} XP</span><span>{toNext} to Lv{level + 1}</span>
              </div>
              <div className="h-1.5 bg-[hsl(260,20%,15%)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${xpAnim ? 'animate-pulse' : ''}`}
                  style={{ width: `${prog}%`, background: 'linear-gradient(90deg, hsl(180 100% 50%), hsl(300 80% 50%))', boxShadow: '0 0 6px hsl(180 100% 50% / 0.6)' }} />
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-[hsl(30,100%,50%)]">
              <HiOutlineFire size={14} /><span className="text-[10px] font-bold">{streak}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5">

          {/* ═══ DASHBOARD ═══ */}
          {screen === 'dashboard' && (
            <div className="max-w-5xl mx-auto space-y-5">
              {/* Banner */}
              <div className="glass-card rounded-lg p-5 neon-border">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[hsl(180,100%,50%)] neon-glow tracking-wide">Assembly Quest</h2>
                    <p className="text-xs text-[hsl(180,50%,45%)] mt-0.5">Master x86 Assembly through interactive challenges</p>
                  </div>
                  <button onClick={() => { const n = MODULES.find(m => !doneMods.includes(m.id) && unlocked(m.id)); if (n) goModule(n.id) }}
                    className="px-4 py-2 bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] rounded font-bold text-xs hover:shadow-[0_0_20px_hsl(180,100%,50%,0.5)] transition-all flex items-center gap-1.5">
                    <FiPlay size={14} /> Continue Learning
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { l: 'Total XP', v: xp, icon: FiStar, c: 'hsl(60,100%,50%)' },
                  { l: 'Level', v: level, icon: FiShield, c: 'hsl(300,80%,50%)' },
                  { l: 'Modules', v: `${doneMods.length}/${MODULES.length}`, icon: FiCheck, c: 'hsl(120,100%,50%)' },
                  { l: 'Challenges', v: doneCh.length, icon: FiTarget, c: 'hsl(180,100%,50%)' },
                ].map(s => (
                  <div key={s.l} className="glass-card rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon size={14} style={{ color: s.c }} /><span className="text-[10px] text-[hsl(180,50%,45%)]">{s.l}</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: s.c }}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* Learning Path */}
              <div>
                <h3 className="text-sm font-bold text-[hsl(180,100%,70%)] mb-3 flex items-center gap-1.5"><FiMap size={15} /> Learning Path</h3>
                <div className="space-y-2">
                  {MODULES.map(m => {
                    const ul = unlocked(m.id), co = completed(m.id), cu = ul && !co
                    const Ic = ICON_MAP[m.icon] || FiCode
                    return (
                      <button key={m.id} onClick={() => ul && goModule(m.id)} disabled={!ul}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group ${co ? 'glass-card border border-[hsl(120,100%,50%,0.3)]' : cu ? 'glass-card neon-border' : 'bg-[hsl(260,20%,8%,0.5)] border border-[hsl(260,20%,15%)] opacity-50 cursor-not-allowed'}`}>
                        <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${co ? 'bg-[hsl(120,100%,50%,0.15)] text-[hsl(120,100%,50%)]' : cu ? 'bg-[hsl(180,100%,50%,0.15)] text-[hsl(180,100%,50%)]' : 'bg-[hsl(260,20%,15%)] text-[hsl(260,20%,30%)]'}`}>
                          {co ? <FiCheck size={18} /> : !ul ? <FiLock size={16} /> : <Ic size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[hsl(180,50%,45%)]">Module {m.id}</span>
                            {co && <span className="text-[9px] px-1 py-0.5 rounded bg-[hsl(120,100%,50%,0.15)] text-[hsl(120,100%,50%)]">COMPLETE</span>}
                            {cu && <span className="text-[9px] px-1 py-0.5 rounded bg-[hsl(180,100%,50%,0.15)] text-[hsl(180,100%,50%)]">CURRENT</span>}
                          </div>
                          <p className={`font-bold text-sm ${co || cu ? 'text-[hsl(180,100%,70%)]' : 'text-[hsl(260,20%,30%)]'}`}>{m.title}</p>
                          <p className="text-[10px] text-[hsl(180,50%,45%)] truncate">{m.desc}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[hsl(60,100%,50%)] shrink-0"><FiStar size={10} />{m.xp} XP</div>
                        {ul && <FiChevronRight size={14} className="text-[hsl(180,50%,45%)] group-hover:text-[hsl(180,100%,50%)] transition-colors shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Achievements Preview */}
              {earned.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-[hsl(180,100%,70%)] mb-3 flex items-center gap-1.5"><FiAward size={15} /> Recent Achievements</h3>
                  <div className="flex flex-wrap gap-2">
                    {ACHIEVEMENTS.filter(a => earned.includes(a.id)).slice(0, 6).map(a => (
                      <div key={a.id} className="glass-card rounded p-2.5 flex items-center gap-2 neon-border">
                        <div className="w-7 h-7 rounded flex items-center justify-center bg-[hsl(60,100%,50%,0.15)] text-[hsl(60,100%,50%)]">{getIcon(a.icon, 'w-3.5 h-3.5')}</div>
                        <div><p className="text-[10px] font-bold text-[hsl(180,100%,70%)]">{a.title}</p><p className="text-[9px] text-[hsl(180,50%,45%)]">{a.desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ MODULE SCREEN ═══ */}
          {screen === 'module' && (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Module Header */}
              <div className="glass-card rounded-lg p-4 neon-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded flex items-center justify-center bg-[hsl(180,100%,50%,0.15)] text-[hsl(180,100%,50%)]">{getIcon(mod.icon, 'w-5 h-5')}</div>
                  <div>
                    <p className="text-[10px] text-[hsl(180,50%,45%)]">Module {mod.id}</p>
                    <h2 className="text-lg font-bold text-[hsl(180,100%,50%)] neon-glow">{mod.title}</h2>
                    <p className="text-xs text-[hsl(180,50%,45%)]">{mod.desc}</p>
                  </div>
                </div>
              </div>

              {/* Concepts */}
              {concepts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[hsl(180,100%,70%)] flex items-center gap-1.5"><FiBookOpen size={14} /> Concept {cIdx + 1} / {concepts.length}</h3>
                  <div className="glass-card rounded-lg p-5 neon-border">
                    <h4 className="text-base font-bold text-[hsl(60,100%,50%)] mb-2">{concepts[cIdx]?.title}</h4>
                    <p className="text-sm text-[hsl(180,100%,70%)] leading-relaxed whitespace-pre-line">{concepts[cIdx]?.content}</p>
                    <div className="mt-3 p-3 rounded bg-[hsl(260,30%,6%)] border border-[hsl(180,60%,30%,0.2)] flex items-center justify-center gap-2">
                      <RiGamepadLine className="text-[hsl(180,100%,50%)]" size={16} />
                      <span className="text-[10px] text-[hsl(180,50%,45%)] font-mono">{concepts[cIdx]?.visual}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <button onClick={() => setCIdx(Math.max(0, cIdx - 1))} disabled={cIdx === 0}
                      className="px-3 py-1.5 rounded text-xs text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,15%)] disabled:opacity-30 transition-all flex items-center gap-1">
                      <FiChevronLeft size={12} /> Prev
                    </button>
                    <div className="flex gap-1">{concepts.map((_, i) => (
                      <button key={i} onClick={() => setCIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === cIdx ? 'bg-[hsl(180,100%,50%)] w-4' : 'bg-[hsl(260,20%,15%)]'}`} />
                    ))}</div>
                    <button onClick={() => cIdx < concepts.length - 1 && setCIdx(cIdx + 1)} disabled={cIdx >= concepts.length - 1}
                      className="px-3 py-1.5 rounded text-xs text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,15%)] disabled:opacity-30 transition-all flex items-center gap-1">
                      Next <FiChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Mini-Game (Module 1) */}
              {modId === 1 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[hsl(300,80%,50%)] flex items-center gap-1.5"><RiGamepadLine size={14} /> Mini-Game: Match the Registers</h3>
                  <div className="glass-card rounded-lg p-4">
                    <p className="text-[10px] text-[hsl(180,50%,45%)] mb-3">Click a role, then click the register it belongs to.</p>
                    {gameDone && (
                      <div className="mb-3 p-2 rounded bg-[hsl(120,100%,50%,0.1)] border border-[hsl(120,100%,50%,0.3)] text-center">
                        <p className="text-xs font-bold text-[hsl(120,100%,50%)]"><FiCheck className="inline mr-1" size={12} /> All correct!</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {REG_GAME.map(g => {
                        const placed = Object.values(gamePlaced).includes(g.value)
                        return (
                          <button key={g.value} onClick={() => !placed && gameClick(g.value)} disabled={placed}
                            className={`p-2 rounded text-[10px] font-mono text-center transition-all ${placed ? 'bg-[hsl(260,20%,10%)] text-[hsl(260,20%,25%)] line-through' : gameSel === g.value ? 'bg-[hsl(180,100%,50%,0.2)] text-[hsl(180,100%,50%)] neon-border' : 'bg-[hsl(260,20%,15%)] text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,18%)]'}`}>
                            {g.value}
                          </button>
                        )
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {REG_GAME.map(g => {
                        const pl = gamePlaced[g.reg]; const ok = pl === g.value
                        return (
                          <button key={g.reg} onClick={() => !pl && gameSel && gameClick(g.reg)}
                            className={`p-2.5 rounded text-center transition-all border ${pl ? ok ? 'border-[hsl(120,100%,50%,0.5)] bg-[hsl(120,100%,50%,0.1)]' : 'border-[hsl(0,100%,55%,0.5)] bg-[hsl(0,100%,55%,0.1)]' : gameSel ? 'border-[hsl(180,100%,50%,0.5)] bg-[hsl(260,20%,12%)] cursor-pointer hover:bg-[hsl(180,100%,50%,0.1)]' : 'border-[hsl(260,20%,20%)] bg-[hsl(260,20%,10%)]'}`}>
                            <p className="text-xs font-bold font-mono text-[hsl(60,100%,50%)]">{g.reg}</p>
                            {pl && <p className={`text-[9px] mt-0.5 ${ok ? 'text-[hsl(120,100%,50%)]' : 'text-[hsl(0,100%,55%)]'}`}>{pl}</p>}
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => { setGamePlaced({}); setGameSel(null); setGameDone(false) }}
                      className="mt-2 text-[10px] text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,70%)] flex items-center gap-1 transition-colors">
                      <FiRefreshCw size={10} /> Reset
                    </button>
                  </div>
                </div>
              )}

              {/* Generic exercise area (non-module-1) */}
              {modId !== 1 && (
                <div className="glass-card rounded-lg p-4">
                  <h3 className="text-xs font-bold text-[hsl(300,80%,50%)] flex items-center gap-1.5 mb-2"><RiGamepadLine size={14} /> Interactive Exercise</h3>
                  <div className="p-3 rounded bg-[hsl(260,30%,6%)] border border-[hsl(180,60%,30%,0.2)]">
                    <p className="text-xs text-[hsl(180,100%,70%)] font-mono text-center">Review the concepts above, then try the challenge!</p>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <button onClick={() => goChallenge(modId, 0)}
                  className="px-6 py-2.5 bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] rounded font-bold text-xs hover:shadow-[0_0_20px_hsl(180,100%,50%,0.5)] transition-all flex items-center gap-1.5">
                  <FiCode size={14} /> Go to Challenge <FiArrowRight size={12} />
                </button>
              </div>
            </div>
          )}

          {/* ═══ CHALLENGE SCREEN ═══ */}
          {screen === 'challenge' && curCh && (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Prompt + Feedback */}
                <div className="space-y-3">
                  <div className="glass-card rounded-lg p-4 neon-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5"><FiTarget size={14} className="text-[hsl(180,100%,50%)]" /><span className="text-[10px] font-bold text-[hsl(180,100%,70%)]">Challenge</span></div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${curCh.difficulty === 'Beginner' ? 'bg-[hsl(120,100%,50%,0.15)] text-[hsl(120,100%,50%)]' : curCh.difficulty === 'Intermediate' ? 'bg-[hsl(60,100%,50%,0.15)] text-[hsl(60,100%,50%)]' : curCh.difficulty === 'Advanced' ? 'bg-[hsl(30,100%,50%,0.15)] text-[hsl(30,100%,50%)]' : 'bg-[hsl(300,80%,50%,0.15)] text-[hsl(300,80%,50%)]'}`}>{curCh.difficulty}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[hsl(60,100%,50%)] mb-2">{mod.title}</h3>
                    <div className="text-xs text-[hsl(180,100%,70%)] whitespace-pre-line leading-relaxed">{curCh.prompt}</div>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[hsl(180,50%,45%)]"><FiStar size={10} className="text-[hsl(60,100%,50%)]" />{curCh.xp} XP</div>
                  </div>

                  {challenges.length > 1 && (
                    <div className="flex gap-1.5">
                      {challenges.map((c, i) => (
                        <button key={c.id} onClick={() => { setChIdx(i); setCode(''); setEvalRes(null); setHintsShown(0) }}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${i === chIdx ? 'bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)]' : doneCh.includes(c.id) ? 'bg-[hsl(120,100%,50%,0.15)] text-[hsl(120,100%,50%)]' : 'bg-[hsl(260,20%,15%)] text-[hsl(180,50%,45%)] hover:bg-[hsl(260,20%,18%)]'}`}>
                          {doneCh.includes(c.id) && <FiCheck className="inline mr-0.5" size={8} />}Ch {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Eval Result */}
                  {evalRes && (
                    <div className={`glass-card rounded-lg p-4 border ${evalRes.pass_fail === 'PASS' || evalRes.is_correct ? 'border-[hsl(120,100%,50%,0.4)]' : 'border-[hsl(0,100%,55%,0.4)]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {evalRes.pass_fail === 'PASS' || evalRes.is_correct ? <FiCheck className="text-[hsl(120,100%,50%)]" size={18} /> : <FiX className="text-[hsl(0,100%,55%)]" size={18} />}
                        <span className={`text-base font-bold ${evalRes.pass_fail === 'PASS' || evalRes.is_correct ? 'text-[hsl(120,100%,50%)]' : 'text-[hsl(0,100%,55%)]'}`}>{evalRes.pass_fail}</span>
                        <span className="text-xs text-[hsl(180,50%,45%)]">Score: {evalRes.score}/100</span>
                        {evalRes.xp_awarded > 0 && <span className="text-xs font-bold text-[hsl(60,100%,50%)]">+{evalRes.xp_awarded} XP</span>}
                      </div>
                      <p className="text-xs text-[hsl(180,100%,70%)] mb-2">{evalRes.feedback}</p>

                      {evalRes.what_code_does && (
                        <div className="mb-1.5"><p className="text-[10px] font-bold text-[hsl(180,50%,45%)] mb-0.5">Your code does:</p><p className="text-[10px] text-[hsl(180,100%,70%)]">{evalRes.what_code_does}</p></div>
                      )}
                      {evalRes.what_was_expected && (
                        <div className="mb-1.5"><p className="text-[10px] font-bold text-[hsl(180,50%,45%)] mb-0.5">Expected:</p><p className="text-[10px] text-[hsl(180,100%,70%)]">{evalRes.what_was_expected}</p></div>
                      )}
                      {evalRes.errors.length > 0 && (
                        <div className="mb-1.5"><p className="text-[10px] font-bold text-[hsl(0,100%,55%)] mb-0.5">Errors:</p>
                          {evalRes.errors.map((e, i) => <p key={i} className="text-[10px] text-[hsl(180,100%,70%)]">- {e}</p>)}
                        </div>
                      )}
                      {evalRes.hints.length > 0 && evalRes.pass_fail !== 'PASS' && !evalRes.is_correct && (
                        <div className="mt-2 pt-2 border-t border-[hsl(260,20%,15%)]">
                          <button onClick={() => setHintsShown(Math.min(hintsShown + 1, evalRes.hints.length))}
                            className="text-[10px] text-[hsl(60,100%,50%)] hover:text-[hsl(60,100%,60%)] flex items-center gap-1 mb-1.5 transition-colors">
                            <FiHelpCircle size={10} /> Reveal Hint ({hintsShown}/{evalRes.hints.length})
                          </button>
                          {evalRes.hints.slice(0, hintsShown).map((h, i) => (
                            <p key={i} className="text-[10px] text-[hsl(60,100%,50%,0.8)] bg-[hsl(60,100%,50%,0.05)] rounded p-1.5 mb-1">Hint {i + 1}: {h}</p>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex gap-1.5">
                        {evalRes.pass_fail !== 'PASS' && !evalRes.is_correct && (
                          <button onClick={() => setEvalRes(null)} className="px-3 py-1.5 text-[10px] font-bold rounded bg-[hsl(260,20%,15%)] text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,18%)] transition-all flex items-center gap-1"><FiRefreshCw size={10} /> Retry</button>
                        )}
                        {(evalRes.pass_fail === 'PASS' || evalRes.is_correct) && (
                          chIdx < challenges.length - 1
                            ? <button onClick={() => { setChIdx(chIdx + 1); setCode(''); setEvalRes(null); setHintsShown(0) }} className="px-3 py-1.5 text-[10px] font-bold rounded bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] hover:shadow-[0_0_15px_hsl(180,100%,50%,0.4)] transition-all flex items-center gap-1">Next <FiArrowRight size={10} /></button>
                            : <button onClick={() => setScreen('dashboard')} className="px-3 py-1.5 text-[10px] font-bold rounded bg-[hsl(120,100%,50%)] text-[hsl(260,30%,6%)] hover:shadow-[0_0_15px_hsl(120,100%,50%,0.4)] transition-all flex items-center gap-1"><FiCheck size={10} /> Complete</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Code Editor */}
                <div className="space-y-3">
                  <div className="glass-card rounded-lg overflow-hidden neon-border">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(180,60%,30%,0.3)] bg-[hsl(260,28%,7%)]">
                      <div className="flex items-center gap-1.5 text-[10px] text-[hsl(180,50%,45%)]"><FiCode size={12} /><span className="font-mono">solution.asm</span></div>
                      {doneCh.includes(curCh.id) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(120,100%,50%,0.15)] text-[hsl(120,100%,50%)] font-bold">SOLVED</span>}
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-8 bg-[hsl(260,30%,6%)] border-r border-[hsl(260,20%,15%)] flex flex-col items-end py-2.5 pr-1.5 text-[9px] text-[hsl(260,20%,30%)] font-mono select-none overflow-hidden">
                        {Array.from({ length: Math.max(code.split('\n').length, 15) }, (_, i) => (
                          <div key={i} className="leading-[1.55rem]">{i + 1}</div>
                        ))}
                      </div>
                      <textarea value={code} onChange={e => setCode(e.target.value)} placeholder={'; Write your x86 Assembly code here...'} spellCheck={false}
                        className="w-full min-h-[340px] bg-[hsl(260,30%,6%)] text-[hsl(180,100%,70%)] font-mono text-xs p-2.5 pl-10 resize-none focus:outline-none leading-[1.55rem] placeholder:text-[hsl(260,20%,25%)]" />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={submitCode} disabled={evalBusy || !code.trim()}
                      className="flex-1 px-5 py-2.5 bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] rounded font-bold text-xs hover:shadow-[0_0_20px_hsl(180,100%,50%,0.5)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5">
                      {evalBusy ? <><FiRefreshCw size={12} className="animate-spin" /> Evaluating...</> : <><FiPlay size={12} /> Submit Answer</>}
                    </button>
                    <button onClick={() => goModule(modId)} className="px-3 py-2.5 rounded text-xs bg-[hsl(260,20%,15%)] text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,18%)] transition-all"><FiChevronLeft size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ACHIEVEMENTS ═══ */}
          {screen === 'achievements' && (
            <div className="max-w-4xl mx-auto space-y-5">
              <h2 className="text-xl font-bold text-[hsl(180,100%,50%)] neon-glow">Achievements</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { l: 'Total XP', v: xp }, { l: 'Modules Done', v: doneMods.length },
                  { l: 'Challenges', v: doneCh.length }, { l: 'Streak', v: `${streak}d` },
                ].map(s => (
                  <div key={s.l} className="glass-card rounded-lg p-3 text-center">
                    <p className="text-[10px] text-[hsl(180,50%,45%)]">{s.l}</p>
                    <p className="text-xl font-bold text-[hsl(180,100%,50%)] mt-0.5">{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {ACHIEVEMENTS.map(a => {
                  const e = earned.includes(a.id)
                  return (
                    <div key={a.id} className={`rounded-lg p-3 flex items-center gap-3 transition-all ${e ? 'glass-card neon-border' : 'bg-[hsl(260,20%,8%,0.5)] border border-[hsl(260,20%,15%)] opacity-40'}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${e ? 'bg-[hsl(60,100%,50%,0.15)] text-[hsl(60,100%,50%)]' : 'bg-[hsl(260,20%,12%)] text-[hsl(260,20%,25%)]'}`}>
                        {e ? getIcon(a.icon, 'w-5 h-5') : <FiLock size={16} />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${e ? 'text-[hsl(180,100%,70%)]' : 'text-[hsl(260,20%,30%)]'}`}>{a.title}</p>
                        <p className="text-[10px] text-[hsl(180,50%,45%)]">{a.desc}</p>
                        {e && <p className="text-[9px] text-[hsl(120,100%,50%)] mt-0.5 font-bold">UNLOCKED</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══ FLOATING TUTOR BUTTON ═══ */}
      {!tutorOpen && (
        <button onClick={() => setTutorOpen(true)} title="Ask Tutor"
          className="fixed bottom-20 right-6 z-30 w-12 h-12 rounded-full bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] flex items-center justify-center shadow-[0_0_20px_hsl(180,100%,50%,0.5)] hover:shadow-[0_0_30px_hsl(180,100%,50%,0.7)] animate-pulse-glow transition-all">
          <FiMessageSquare size={20} />
        </button>
      )}

      {/* ═══ TUTOR CHAT PANEL ═══ */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-80 md:w-96 z-40 transform transition-transform duration-300 ${tutorOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col bg-[hsl(260,28%,7%)] border-l border-[hsl(180,60%,30%)]">
          <div className="flex items-center justify-between p-3 border-b border-[hsl(180,50%,25%)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[hsl(180,100%,50%,0.15)] flex items-center justify-center"><FiCpu size={14} className="text-[hsl(180,100%,50%)]" /></div>
              <div><p className="text-xs font-bold text-[hsl(180,100%,70%)]">Assembly Tutor</p><p className="text-[9px] text-[hsl(180,50%,45%)]">{mod.title}</p></div>
            </div>
            <button onClick={() => setTutorOpen(false)} className="p-1 rounded hover:bg-[hsl(260,20%,15%)] text-[hsl(180,50%,45%)] transition-colors"><FiX size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {msgs.length === 0 && (
              <div className="text-center py-6">
                <FiHelpCircle size={28} className="mx-auto text-[hsl(180,50%,45%)] mb-2" />
                <p className="text-xs text-[hsl(180,50%,45%)] mb-3">Ask me anything about x86 Assembly!</p>
                <div className="space-y-1.5">
                  {['What are registers?', 'Explain the stack', 'How does MOV work?', 'What is INT 0x80?'].map(q => (
                    <button key={q} onClick={() => sendTutor(q)}
                      className="block w-full text-[10px] text-left px-2.5 py-1.5 rounded bg-[hsl(260,20%,12%)] text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,15%)] transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-2.5 ${m.role === 'user' ? 'bg-[hsl(180,100%,50%,0.15)] border border-[hsl(180,100%,50%,0.3)]' : 'glass-card'}`}>
                  <p className="text-xs text-[hsl(180,100%,70%)] whitespace-pre-line">{m.text}</p>
                  {m.code && m.code.trim() && (
                    <div className="mt-1.5 p-1.5 rounded bg-[hsl(260,30%,6%)] border border-[hsl(180,60%,30%,0.2)]">
                      <pre className="text-[10px] font-mono text-[hsl(120,100%,50%)] overflow-x-auto whitespace-pre">{m.code}</pre>
                    </div>
                  )}
                  {m.analogy && m.analogy.trim() && (
                    <div className="mt-1.5 p-1.5 rounded bg-[hsl(300,80%,50%,0.08)] border border-[hsl(300,80%,50%,0.2)]">
                      <p className="text-[10px] text-[hsl(300,80%,70%)] italic">{m.analogy}</p>
                    </div>
                  )}
                  {m.followUps && m.followUps.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.followUps.map((q, j) => (
                        <button key={j} onClick={() => sendTutor(q)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(260,20%,12%)] text-[hsl(180,100%,70%)] hover:bg-[hsl(260,20%,15%)] transition-colors">{q}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatBusy && (
              <div className="flex justify-start">
                <div className="glass-card rounded-lg p-2.5 flex items-center gap-1.5">
                  <FiRefreshCw size={10} className="animate-spin text-[hsl(180,100%,50%)]" />
                  <span className="text-[10px] text-[hsl(180,50%,45%)]">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          <div className="p-2.5 border-t border-[hsl(180,50%,25%)]">
            <div className="flex gap-1.5">
              <input type="text" value={chatIn} onChange={e => setChatIn(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutor(chatIn) } }}
                placeholder="Ask about Assembly..." className="flex-1 bg-[hsl(260,20%,12%)] border border-[hsl(180,60%,30%,0.3)] rounded px-2.5 py-1.5 text-xs text-[hsl(180,100%,70%)] placeholder:text-[hsl(260,20%,25%)] focus:outline-none focus:border-[hsl(180,100%,50%)] transition-colors" />
              <button onClick={() => sendTutor(chatIn)} disabled={chatBusy || !chatIn.trim()}
                className="px-2.5 py-1.5 bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] rounded font-bold hover:shadow-[0_0_10px_hsl(180,100%,50%,0.4)] disabled:opacity-40 transition-all">
                <FiSend size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {tutorOpen && <div className="fixed inset-0 bg-black/50 z-30 sm:hidden" onClick={() => setTutorOpen(false)} />}
    </div>
  )
}
