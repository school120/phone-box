import React, { useState, useRef } from 'react';
import { Camera, Upload, X, AlertCircle, CheckCircle } from 'lucide-react';

export default function PhoneCabinetScanner() {
  const [students, setStudents] = useState([]);
  const [selectedBox, setSelectedBox] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const boxes = ['9A', '9B', '9C', '9D', '10A', '10B', '10C', '10D', 
                 '11A', '11B', '11C', '11D', '12A', '12B', '12C', '12D', 
                 'SM1', 'SM2'];

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const parsed = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          return {
            personId: values[0],
            fullName: values[1],
            grade: values[2],
            gender: values[3],
            securityNumber: values[4]
          };
        });

      setStudents(parsed);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleImageCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!capturedImage || !selectedBox || students.length === 0) {
      setError('Please upload student data, select a box, and capture an image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Filter students for selected box
      const boxStudents = students.filter(s => {
        const secNum = s.securityNumber;
        if (selectedBox.startsWith('SM')) {
          return secNum.startsWith(selectedBox);
        }
        return secNum.startsWith(selectedBox);
      });

      // Prepare the API call
      const base64Image = capturedImage.split(',')[1];
      
      const prompt = `You are analyzing a phone storage cabinet. This cabinet has numbered slots arranged in rows.

I need you to identify which slots appear to be EMPTY (no phone present) in this image.

The slots are numbered 1-60, arranged in a 10x6 grid (10 columns, 6 rows).
- Row 1: Slots 1-10
- Row 2: Slots 11-20  
- Row 3: Slots 21-30
- Row 4: Slots 31-40
- Row 5: Slots 41-50
- Row 6: Slots 51-60

Look carefully at each visible slot and identify which ones are EMPTY (no phone visible).

Respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{
  "emptySlots": [1, 5, 23, 34],
  "totalSlotsVisible": 60,
  "confidence": "high"
}

List only the slot numbers that are clearly empty.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();
      const responseText = data.content[0].text.trim();
      
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        // Try to extract JSON from markdown
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse AI response');
        }
      }

      // Match empty slots to students
      const missingStudents = parsed.emptySlots
        .map(slot => {
          return boxStudents.find(s => {
            const secNum = s.securityNumber;
            const slotNum = secNum.match(/\d+$/);
            return slotNum && parseInt(slotNum[0]) === slot;
          });
        })
        .filter(Boolean);

      setAnalysis({
        emptySlots: parsed.emptySlots,
        missingStudents,
        totalStudentsInBox: boxStudents.length,
        confidence: parsed.confidence
      });

    } catch (err) {
      setError('Analysis failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Camera className="text-indigo-600" size={32} />
            Phone Cabinet Scanner
          </h1>
          <p className="text-gray-600 mb-6">
            Upload student roster, select box, and scan to find missing phones
          </p>

          {/* Step 1: Upload CSV */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Step 1: Upload Student Roster (CSV)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {students.length > 0 && (
              <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={16} />
                {students.length} students loaded
              </p>
            )}
          </div>

          {/* Step 2: Select Box */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Step 2: Select Box to Scan
            </label>
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Select a Box --</option>
              {boxes.map(box => (
                <option key={box} value={box}>{box}</option>
              ))}
            </select>
          </div>

          {/* Step 3: Capture Image */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Step 3: Capture Cabinet Photo
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 font-medium"
              >
                <Camera size={20} />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-2 font-medium"
              >
                <Upload size={20} />
                Upload Image
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageCapture}
              className="hidden"
            />
          </div>

          {/* Preview Image */}
          {capturedImage && (
            <div className="mb-6 relative">
              <img
                src={capturedImage}
                alt="Cabinet"
                className="w-full rounded-lg border-2 border-gray-200"
              />
              <button
                onClick={reset}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* Analyze Button */}
          {capturedImage && selectedBox && students.length > 0 && !analysis && (
            <button
              onClick={analyzeImage}
              disabled={loading}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze Cabinet'}
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Results for Box {selectedBox}
            </h2>
            
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">
                Empty Slots Detected: <span className="font-bold">{analysis.emptySlots.join(', ')}</span>
              </p>
              <p className="text-sm text-gray-600">
                Confidence: <span className="font-bold capitalize">{analysis.confidence}</span>
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">
              Missing Students ({analysis.missingStudents.length})
            </h3>

            {analysis.missingStudents.length === 0 ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium flex items-center gap-2">
                  <CheckCircle size={20} />
                  All phones accounted for!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {analysis.missingStudents.map((student, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <p className="font-semibold text-gray-800">{student.fullName}</p>
                    <p className="text-sm text-gray-600">
                      {student.grade} • {student.gender} • Slot: {student.securityNumber}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={reset}
              className="mt-6 w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-semibold"
            >
              Scan Another Box
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
