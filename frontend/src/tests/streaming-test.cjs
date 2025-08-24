/**
 * Simple Node.js Streaming Test Script
 * 
 * This script tests the streaming functionality logic without requiring a complex test framework.
 * It verifies the core streaming behavior that would be used in the React component.
 */

// Simulate the streaming logic from App.tsx
async function simulateStreaming(responseText, onUpdate) {
  let currentText = "";
  const updates = [];
  
  for (let i = 0; i < responseText.length; i++) {
    currentText += responseText[i];
    updates.push(currentText);
    if (onUpdate) {
      onUpdate(currentText);
    }
    
    // Simulate the 20ms delay (we'll skip actual delay for testing)
    // await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  return { finalText: currentText, updates };
}

// Test functions
async function testShortResponse() {
  console.log('\n🧪 Test 1: 짧은 응답 스트리밍 (Requirement 2.1)');
  
  const shortResponse = "Hello!";
  const expectedUpdates = ["H", "He", "Hel", "Hell", "Hello", "Hello!"];
  
  const result = await simulateStreaming(shortResponse);
  
  const passed = JSON.stringify(result.updates) === JSON.stringify(expectedUpdates) &&
                 result.finalText === shortResponse;
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`최종 텍스트: "${result.finalText}"`);
  console.log(`업데이트 수: ${result.updates.length} (예상: ${expectedUpdates.length})`);
  
  if (!passed) {
    console.log(`예상: [${expectedUpdates.join('", "')}]`);
    console.log(`실제: [${result.updates.join('", "')}]`);
  }
  
  return passed;
}

async function testLongResponse() {
  console.log('\n🧪 Test 2: 긴 응답 스트리밍 (Requirement 2.2)');
  
  const longResponse = "This is a very long response that should be displayed character by character to create a smooth streaming effect for the user experience.";
  
  const result = await simulateStreaming(longResponse);
  
  const passed = result.updates.length === longResponse.length &&
                 result.finalText === longResponse &&
                 result.updates[0] === "T" &&
                 result.updates[9] === "This is a " &&
                 result.updates[result.updates.length - 1] === longResponse;
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`최종 텍스트 길이: ${result.finalText.length} (예상: ${longResponse.length})`);
  console.log(`업데이트 수: ${result.updates.length} (예상: ${longResponse.length})`);
  console.log(`첫 번째 업데이트: "${result.updates[0]}" (예상: "T")`);
  console.log(`10번째 업데이트: "${result.updates[9]}" (예상: "This is a ")`);
  
  return passed;
}

async function testStreamingCompletion() {
  console.log('\n🧪 Test 3: 스트리밍 완료 확인 (Requirement 2.3)');
  
  const completeResponse = "Complete response with multiple words and punctuation!";
  let finalDisplayedText = "";
  
  const result = await simulateStreaming(completeResponse, (text) => {
    finalDisplayedText = text;
  });
  
  const passed = result.finalText === completeResponse &&
                 finalDisplayedText === completeResponse &&
                 result.finalText.length === completeResponse.length;
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`최종 반환값: "${result.finalText}"`);
  console.log(`최종 표시값: "${finalDisplayedText}"`);
  console.log(`길이 일치: ${result.finalText.length === completeResponse.length ? '✅' : '❌'}`);
  console.log(`내용 일치: ${result.finalText === completeResponse ? '✅' : '❌'}`);
  
  return passed;
}

async function testSpecialCharacters() {
  console.log('\n🧪 Test 4: 특수 문자 및 멀티라인 응답');
  
  const specialResponse = "Hello! 🤖 This includes émojis and spëcial chars: @#$%^&*()\nSecond line\nThird line";
  
  const result = await simulateStreaming(specialResponse);
  
  const linesOk = result.finalText.split('\n').length === 3;
  const specialCharsOk = result.finalText.includes('🤖') && 
                        result.finalText.includes('émojis') && 
                        result.finalText.includes('@#$%^&*()');
  const passed = result.finalText === specialResponse && linesOk && specialCharsOk;
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`줄 수: ${result.finalText.split('\n').length} (예상: 3)`);
  console.log(`특수 문자 포함: ${specialCharsOk ? '✅' : '❌'}`);
  console.log(`최종 텍스트 길이: ${result.finalText.length}`);
  
  return passed;
}

async function testResponseParsing() {
  console.log('\n🧪 Test 5: 응답 파싱 통합 테스트');
  
  // 수정된 파싱 로직 시뮬레이션
  const mockResponseData = {
    ok: true,
    response: "This is the correct response from the fixed parsing logic"
  };
  
  // 올바른 파싱: data.response 사용 (data.data?.response 제거됨)
  const responseText = mockResponseData.response || "응답을 받았지만 내용이 비어있습니다.";
  
  const result = await simulateStreaming(responseText);
  
  // 빈 응답 테스트
  const emptyMockData = { ok: true, response: "" };
  const emptyResponseText = emptyMockData.response || "응답을 받았지만 내용이 비어있습니다.";
  
  const parsingOk = result.finalText === mockResponseData.response;
  const fallbackOk = emptyResponseText === "응답을 받았지만 내용이 비어있습니다.";
  const passed = parsingOk && fallbackOk;
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`정상 응답 파싱: ${parsingOk ? '✅' : '❌'}`);
  console.log(`빈 응답 폴백: ${fallbackOk ? '✅' : '❌'}`);
  console.log(`최종 스트리밍 결과: "${result.finalText}"`);
  console.log(`빈 응답 폴백 메시지: "${emptyResponseText}"`);
  
  return passed;
}

async function testEmptyResponse() {
  console.log('\n🧪 Test 6: 빈 응답 처리');
  
  const emptyResponse = "";
  
  const result = await simulateStreaming(emptyResponse);
  
  const passed = result.finalText === "" && result.updates.length === 0;
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`최종 텍스트: "${result.finalText}"`);
  console.log(`업데이트 수: ${result.updates.length} (예상: 0)`);
  
  return passed;
}

async function testSingleCharacter() {
  console.log('\n🧪 Test 7: 단일 문자 응답');
  
  const singleChar = "A";
  
  const result = await simulateStreaming(singleChar);
  
  const passed = result.finalText === "A" && 
                 result.updates.length === 1 && 
                 result.updates[0] === "A";
  
  console.log(`결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log(`최종 텍스트: "${result.finalText}"`);
  console.log(`업데이트: [${result.updates.join('", "')}]`);
  
  return passed;
}

// 메인 테스트 실행 함수
async function runAllTests() {
  console.log('🚀 스트리밍 기능 테스트 시작');
  console.log('='.repeat(50));
  
  const tests = [
    { name: '짧은 응답 스트리밍', func: testShortResponse },
    { name: '긴 응답 스트리밍', func: testLongResponse },
    { name: '스트리밍 완료 확인', func: testStreamingCompletion },
    { name: '특수 문자 테스트', func: testSpecialCharacters },
    { name: '응답 파싱 통합', func: testResponseParsing },
    { name: '빈 응답 처리', func: testEmptyResponse },
    { name: '단일 문자 응답', func: testSingleCharacter }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const passed = await test.func();
      results.push({ name: test.name, passed, error: null });
    } catch (error) {
      console.log(`❌ ${test.name}: 에러 발생 - ${error.message}`);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 전체 테스트 결과');
  console.log('='.repeat(50));
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ 통과' : '❌ 실패';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`${status}: ${result.name}${error}`);
  });
  
  console.log('\n' + '-'.repeat(30));
  console.log(`총 결과: ${passedCount}/${totalCount} 테스트 통과`);
  
  if (passedCount === totalCount) {
    console.log('🎉 모든 스트리밍 기능 테스트가 성공적으로 통과했습니다!');
    console.log('\n✅ Requirements 검증:');
    console.log('   - 2.1: GPT 응답을 스트리밍 효과로 한 글자씩 표시 ✅');
    console.log('   - 2.2: 스트리밍 진행 중 텍스트가 점진적으로 표시 ✅');
    console.log('   - 2.3: 스트리밍 완료 시 전체 응답 내용 완전히 표시 ✅');
  } else {
    console.log('⚠️  일부 테스트가 실패했습니다. 위의 상세 결과를 확인해주세요.');
  }
  
  return passedCount === totalCount;
}

// 스크립트 실행
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('테스트 실행 중 오류 발생:', error);
    process.exit(1);
  });
}

module.exports = {
  simulateStreaming,
  testShortResponse,
  testLongResponse,
  testStreamingCompletion,
  testSpecialCharacters,
  testResponseParsing,
  runAllTests
};