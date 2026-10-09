#include <jni.h>
#include <node.h>
#include <string>
#include <vector>

extern "C" JNIEXPORT jint JNICALL
Java_org_strongholdprotocol_alliance_MainActivity_startNode(
    JNIEnv* env, jclass, jstring scriptPath) {
  const char* raw = env->GetStringUTFChars(scriptPath, nullptr);
  std::string script(raw);
  env->ReleaseStringUTFChars(scriptPath, raw);

  // libuv expects the argv strings to occupy one contiguous buffer.
  std::string executable("node");
  std::vector<char> storage;
  storage.insert(storage.end(), executable.begin(), executable.end());
  storage.push_back('\0');
  const size_t scriptOffset = storage.size();
  storage.insert(storage.end(), script.begin(), script.end());
  storage.push_back('\0');
  char* argv[] = {storage.data(), storage.data() + scriptOffset};
  return node::Start(2, argv);
}
