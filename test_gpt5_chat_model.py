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

def fix_encoding(text):
    """修复可能的编码问题"""
    try:
        # 尝试修复双重编码问题：Latin-1 → UTF-8
        fixed_bytes = text.encode('latin-1')
        fixed_text = fixed_bytes.decode('utf-8')
        return fixed_text
    except:
        return text

def process_stream_response(response):
    """处理流式响应"""
    content_chunks = []
    usage = {}
    
    print("🌊 开始处理流式响应...")
    
    try:
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                print(f"📝 收到数据: {line_str[:100]}{'...' if len(line_str) > 100 else ''}")
                
                if line_str.startswith('data: ') and not line_str.endswith('[DONE]'):
                    try:
                        data_str = line_str[6:]  # 移除 'data: '
                        data = json.loads(data_str)
                        
                        if 'choices' in data and data['choices']:
                            delta = data['choices'][0].get('delta', {})
                            if 'content' in delta:
                                # 尝试修复编码问题
                                content = delta['content']
                                fixed_content = fix_encoding(content)
                                content_chunks.append(fixed_content)
                                print(f"💬 内容片段: {repr(fixed_content)}")
                        
                        # 提取usage信息（通常在最后一个chunk中）
                        if 'usage' in data:
                            usage = data['usage']
                            
                    except json.JSONDecodeError as e:
                        print(f"⚠️ 解析流式数据失败: {e}")
                        continue
                elif line_str.strip() == 'data: [DONE]':
                    print("✅ 流式响应完成")
                    break
    except Exception as e:
        print(f"⚠️ 处理流式响应异常: {e}")
    
    content = ''.join(content_chunks)
    print(f"🎯 流式响应汇总: {len(content_chunks)} 个片段，总长度 {len(content)} 字符")
    return content, usage

def test_model_response(model_name, test_name, use_stream=False):
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
    print(f"🌊 模式: {'流式输出' if use_stream else '非流式输出'}")
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
            "stream": use_stream
        }
        
        try:
            start_time = time.time()
            
            if use_stream:
                # 流式请求
                response = requests.post(url, headers=headers, json=payload, timeout=30, stream=True)
            else:
                # 非流式请求
                response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 200:
                if use_stream:
                    # 处理流式响应
                    content, usage = process_stream_response(response)
                else:
                    # 处理非流式响应
                    result = response.json()
                    content = ""
                    if 'choices' in result and len(result['choices']) > 0:
                        content = result['choices'][0]['message']['content']
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

def print_summary(non_stream_results, stream_results=None):
    """打印测试结果总结"""
    print(f"\n{'='*80}")
    print("📊 测试结果总结")
    print('='*80)
    
    # 非流式模式结果
    print(f"\n📋 非流式模式结果:")
    successful_tests = sum(1 for r in non_stream_results if r['success'])
    content_tests = sum(1 for r in non_stream_results if r.get('has_content', False))
    
    print(f"   ✅ 成功调用: {successful_tests}/{len(non_stream_results)}")
    print(f"   💬 有内容回复: {content_tests}/{len(non_stream_results)}")
    
    if content_tests > 0:
        avg_response_time = sum(r.get('response_time', 0) for r in non_stream_results if r['success']) / successful_tests
        avg_content_length = sum(r.get('content_length', 0) for r in non_stream_results if r.get('has_content', False)) / content_tests
        print(f"   ⏱️  平均响应时间: {avg_response_time:.2f}秒")
        print(f"   📝 平均回复长度: {avg_content_length:.0f}字符")
    
    # 流式模式结果（如果有）
    if stream_results:
        print(f"\n🌊 流式模式结果:")
        stream_successful = sum(1 for r in stream_results if r['success'])
        stream_content = sum(1 for r in stream_results if r.get('has_content', False))
        
        print(f"   ✅ 成功调用: {stream_successful}/{len(stream_results)}")
        print(f"   💬 有内容回复: {stream_content}/{len(stream_results)}")
        
        if stream_content > 0:
            stream_avg_time = sum(r.get('response_time', 0) for r in stream_results if r['success']) / stream_successful
            stream_avg_length = sum(r.get('content_length', 0) for r in stream_results if r.get('has_content', False)) / stream_content
            print(f"   ⏱️  平均响应时间: {stream_avg_time:.2f}秒")
            print(f"   📝 平均回复长度: {stream_avg_length:.0f}字符")
        
        print(f"\n📈 模式对比:")
        print(f"   非流式成功率: {content_tests}/{len(non_stream_results)} ({content_tests/len(non_stream_results)*100:.1f}%)")
        print(f"   流式成功率: {stream_content}/{len(stream_results)} ({stream_content/len(stream_results)*100:.1f}%)")
        
        if content_tests > 0 and stream_content > 0:
            non_stream_avg_time = sum(r.get('response_time', 0) for r in non_stream_results if r['success']) / successful_tests
            stream_avg_time = sum(r.get('response_time', 0) for r in stream_results if r['success']) / stream_successful
            print(f"   响应时间对比: 非流式 {non_stream_avg_time:.2f}s vs 流式 {stream_avg_time:.2f}s")
    
    # 建议
    print(f"\n💡 建议:")
    if content_tests == len(non_stream_results):
        print("   ✅ 非流式模式完全正常，推荐使用")
        if stream_results:
            if sum(1 for r in stream_results if r.get('has_content', False)) == len(stream_results):
                print("   ✅ 流式模式也正常，编码修复有效")
            else:
                print("   ⚠️  流式模式有问题，建议使用非流式模式")
        else:
            print("   💡 可以尝试流式模式来对比性能")
    elif content_tests > 0:
        print("   ⚠️  部分测试成功，建议检查失败的测试用例")
    else:
        print("   ❌ 所有测试都失败，需要检查模型配置或API设置")

def main():
    print("🚀 开始测试GPT-5 Chat模型回复功能...")
    print("🎯 目标：验证流式和非流式输出模式")
    
    # 测试非流式模式
    print("\n" + "="*60)
    print("📋 第一轮：非流式模式测试")
    print("="*60)
    non_stream_results = test_model_response(NEW_MODEL, "非流式模式", use_stream=False)
    
    # 询问是否测试流式模式
    print(f"\n❓ 是否也测试流式模式？")
    print("   注意：流式模式可能有中文编码问题，但我们已添加修复逻辑")
    print("   流式模式会显示详细的数据接收过程")
    
    try:
        user_input = input("输入 'y' 或 'yes' 来测试流式模式，其他任意键跳过: ").lower().strip()
        test_stream = user_input in ['y', 'yes']
    except:
        test_stream = False
    
    stream_results = None
    if test_stream:
        print("\n" + "="*60)
        print("🌊 第二轮：流式模式测试")
        print("="*60)
        stream_results = test_model_response(NEW_MODEL, "流式模式", use_stream=True)
    
    # 打印总结
    print_summary(non_stream_results, stream_results)
    
    print(f"\n🏁 测试完成!")
    print(f"📄 测试文件保存在: {__file__}")

if __name__ == "__main__":
    main()
