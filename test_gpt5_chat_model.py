#!/usr/bin/env python3
"""
测试GPT-5 Chat模型的回复功能
验证从gpt-5-2025-08-07切换到gpt-5-chat-2025-08-07后是否能正常回复
"""
import requests
import json
import time
from datetime import datetime

# 从配置文件读取的API信息
BASE_URL = "https://api.aiznt.com"
API_KEY = "sk-AyobioLworaCLNbs1zD0aDdTP3zZFmIdCDwgu3kfvBFCS8IH"
NEW_MODEL = "gemini-2.5-flash-preview-05-20"  # 新的聊天模型
OLD_MODEL = "gpt-5-2025-08-07"       # 旧的推理模型

def test_model_response(model_name, test_name):
    """测试指定模型的回复功能"""
    url = f"{BASE_URL.rstrip('/')}/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 测试用例
    test_cases = [
        {
            "name": "中文问候",
            "content": "你好，请简单介绍一下你自己",
            "max_tokens": 150
        },
        {
            "name": "英文问候", 
            "content": "Hello, how are you?",
            "max_tokens": 100
        },
        {
            "name": "简单数学",
            "content": "1+1等于几？",
            "max_tokens": 50
        },
        {
            "name": "创意问题",
            "content": "给我讲一个关于AI的笑话",
            "max_tokens": 200
        }
    ]
    
    print(f"\n{'='*80}")
    print(f"🤖 测试模型: {model_name} ({test_name})")
    print(f"⏰ 测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print('='*80)
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 测试 {i}: {test_case['name']}")
        print(f"❓ 问题: {test_case['content']}")
        print("-" * 60)
        
        payload = {
            "model": model_name,
            "messages": [
                {"role": "user", "content": test_case['content']}
            ],
            "max_tokens": test_case['max_tokens'],
            "temperature": 0.7,
            "stream": False
        }
        
        try:
            start_time = time.time()
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                # 提取回复内容
                content = ""
                if 'choices' in result and len(result['choices']) > 0:
                    content = result['choices'][0]['message']['content']
                
                # 提取token使用情况
                usage = result.get('usage', {})
                completion_tokens = usage.get('completion_tokens', 0)
                reasoning_tokens = usage.get('completion_tokens_details', {}).get('reasoning_tokens', 0)
                prompt_tokens = usage.get('prompt_tokens', 0)
                
                # 判断回复状态
                has_content = bool(content and content.strip())
                
                print(f"✅ 调用成功 (耗时: {response_time:.2f}秒)")
                print(f"📊 Token使用: 输入={prompt_tokens}, 输出={completion_tokens}, 推理={reasoning_tokens}")
                print(f"🎯 回复状态: {'✅ 有内容' if has_content else '❌ 空回复'}")
                
                if has_content:
                    print(f"💬 回复内容: {content[:200]}{'...' if len(content) > 200 else ''}")
                else:
                    print("💬 回复内容: [空]")
                
                # 记录结果
                results.append({
                    'test_name': test_case['name'],
                    'success': True,
                    'has_content': has_content,
                    'response_time': response_time,
                    'content_length': len(content),
                    'tokens': {
                        'prompt': prompt_tokens,
                        'completion': completion_tokens,
                        'reasoning': reasoning_tokens
                    }
                })
                
            else:
                print(f"❌ 调用失败 (状态码: {response.status_code})")
                print(f"错误信息: {response.text}")
                
                results.append({
                    'test_name': test_case['name'],
                    'success': False,
                    'has_content': False,
                    'error': f"HTTP {response.status_code}: {response.text[:100]}"
                })
                
        except requests.exceptions.Timeout:
            print("⏰ 请求超时")
            results.append({
                'test_name': test_case['name'],
                'success': False,
                'has_content': False,
                'error': "请求超时"
            })
        except Exception as e:
            print(f"❌ 发生异常: {str(e)}")
            results.append({
                'test_name': test_case['name'],
                'success': False,
                'has_content': False,
                'error': str(e)
            })
    
    return results

def print_summary(new_results, old_results=None):
    """打印测试结果总结"""
    print(f"\n{'='*80}")
    print("📊 测试结果总结")
    print('='*80)
    
    # 新模型结果
    print(f"\n🆕 新模型 (gpt-5-chat-2025-08-07) 结果:")
    successful_tests = sum(1 for r in new_results if r['success'])
    content_tests = sum(1 for r in new_results if r.get('has_content', False))
    
    print(f"   ✅ 成功调用: {successful_tests}/{len(new_results)}")
    print(f"   💬 有内容回复: {content_tests}/{len(new_results)}")
    
    if content_tests > 0:
        avg_response_time = sum(r.get('response_time', 0) for r in new_results if r['success']) / successful_tests
        avg_content_length = sum(r.get('content_length', 0) for r in new_results if r.get('has_content', False)) / content_tests
        print(f"   ⏱️  平均响应时间: {avg_response_time:.2f}秒")
        print(f"   📝 平均回复长度: {avg_content_length:.0f}字符")
    
    # 对比旧模型（如果有）
    if old_results:
        print(f"\n🔄 旧模型 (gpt-5-2025-08-07) 对比:")
        old_successful = sum(1 for r in old_results if r['success'])
        old_content = sum(1 for r in old_results if r.get('has_content', False))
        
        print(f"   ✅ 成功调用: {old_successful}/{len(old_results)}")
        print(f"   💬 有内容回复: {old_content}/{len(old_results)}")
        
        print(f"\n📈 改进效果:")
        print(f"   回复率提升: {old_content}/{len(old_results)} → {content_tests}/{len(new_results)}")
        
        if old_content == 0 and content_tests > 0:
            print("   🎉 从完全无回复改善为正常回复！")
    
    # 建议
    print(f"\n💡 建议:")
    if content_tests == len(new_results):
        print("   ✅ 所有测试都成功，模型配置正常，可以在Coze中使用")
    elif content_tests > 0:
        print("   ⚠️  部分测试成功，建议检查失败的测试用例")
    else:
        print("   ❌ 所有测试都失败，需要检查模型配置或API设置")

def main():
    print("🚀 开始测试GPT-5 Chat模型回复功能...")
    print("🎯 目标：验证切换到gpt-5-chat-2025-08-07后是否能正常回复")
    
    # 测试新模型（主要测试）
    new_results = test_model_response(NEW_MODEL, "新聊天模型")
    
    # 可选：也测试旧模型作对比（如果你想看对比效果）
    print(f"\n❓ 是否也测试旧模型作对比？(可能会出现空回复)")
    print("   注意：旧模型测试可能会消耗更多token且回复为空")
    
    # 这里我们跳过旧模型测试，只测试新模型
    old_results = None
    
    # 打印总结
    print_summary(new_results, old_results)
    
    print(f"\n🏁 测试完成!")
    print(f"📄 测试文件保存在: {__file__}")

if __name__ == "__main__":
    main()
