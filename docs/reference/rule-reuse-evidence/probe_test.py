import pathlib
import subprocess
import types
import unittest
from probe import fixture_command, hermetic_environment

ENVIRONMENT={'HOME':'/fixture/home','USERPROFILE':'/fixture/home','GIT_CONFIG_GLOBAL':'/fixture/home/.gitconfig','GIT_CONFIG_SYSTEM':'/fixture/home/.gitconfig-system','GIT_CONFIG_NOSYSTEM':'1','GIT_TERMINAL_PROMPT':'0','GIT_AUTHOR_NAME':'Fixture','GIT_AUTHOR_EMAIL':'fixture@example.invalid','GIT_COMMITTER_NAME':'Fixture','GIT_COMMITTER_EMAIL':'fixture@example.invalid'}
BINDINGS={'GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_PREFIX','GIT_NAMESPACE','GIT_GRAFT_FILE','GIT_INDEX_VERSION','GIT_CEILING_DIRECTORIES'}

def read_seat(value):
 calls=[]
 def read(args,**options):
  calls.append((args,options))
  return value
 return read,calls

def child_seat(status=0):
 calls=[]
 def runner(args,**options):
  calls.append((args,options))
  return types.SimpleNamespace(returncode=status,stdout='{}\n',stderr='refused')
 return runner,calls

def failed_read(args,**options):
 raise subprocess.CalledProcessError(1,args)

def build(read):
 return hermetic_environment(tools=pathlib.Path('/installed/tools'),config_home=pathlib.Path('/fixture/home'),bun='fixture-bun',read=read)

class ProbeBoundaryTests(unittest.TestCase):
 def test_builder_uses_shipped_helper_and_private_home(self):
  read,calls=read_seat('{"HOME":"/fixture/home","GIT_TERMINAL_PROMPT":"0"}')
  result=build(read)
  self.assertEqual(result,{'HOME':'/fixture/home','GIT_TERMINAL_PROMPT':'0'})
  self.assertEqual(calls[0][0][:2],['fixture-bun','-e'])
  self.assertIn('/installed/tools/hermetic-git/hermetic-git-environment.ts',calls[0][0][2])
  self.assertIn('hermeticGitEnvironment({configHome:"/fixture/home"})',calls[0][0][2])
  self.assertEqual(calls[0][1],{'text':True})

 def test_failed_builder_refuses(self):
  with self.assertRaises(subprocess.CalledProcessError):build(failed_read)

 def test_invalid_json_refuses(self):
  read,calls=read_seat('not-json')
  with self.assertRaises(ValueError):build(read)

 def test_nonmapping_environment_refuses(self):
  read,calls=read_seat('[]')
  with self.assertRaises(ValueError):build(read)

 def test_nonstring_entries_refuse(self):
  read,calls=read_seat('{"HOME":3}')
  with self.assertRaises(ValueError):build(read)

 def test_git_and_decay_receive_exact_isolated_environment(self):
  runner,calls=child_seat()
  self.assertEqual(fixture_command(args=['git','init','-q'],root=pathlib.Path('/fixture'),environment=ENVIRONMENT,runner=runner),'{}')
  self.assertEqual(fixture_command(args=['bun','/tools/rin-harness-carve-out-decay.ts','--project-dir','/fixture'],root=pathlib.Path('/fixture'),environment=ENVIRONMENT,runner=runner),'{}')
  self.assertIs(calls[0][1]['env'],ENVIRONMENT)
  self.assertIs(calls[1][1]['env'],ENVIRONMENT)
  self.assertEqual(calls[0][1]['cwd'],pathlib.Path('/fixture'))
  self.assertEqual(calls[1][1]['cwd'],pathlib.Path('/fixture'))
  self.assertTrue(calls[0][1]['capture_output'])
  self.assertTrue(calls[1][1]['capture_output'])
  self.assertTrue(BINDINGS.isdisjoint(calls[0][1]['env']))
  self.assertTrue(BINDINGS.isdisjoint(calls[1][1]['env']))

 def test_expected_child_refusal_is_returned(self):
  runner,calls=child_seat(1)
  self.assertEqual(fixture_command(args=['bun','decay'],root='/fixture',environment=ENVIRONMENT,expected=1,runner=runner),'{}')

 def test_unexpected_child_exit_refuses(self):
  runner,calls=child_seat(1)
  with self.assertRaises(AssertionError):
   fixture_command(args=['git','init'],root='/fixture',environment=ENVIRONMENT,runner=runner)

if __name__ == '__main__':
 unittest.main()
