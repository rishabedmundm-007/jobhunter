import { getAuthUrl } from '../utils/auth'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const handleSignIn = () => {
    window.location.href = getAuthUrl()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="bg-white p-12 rounded-lg shadow-2xl text-center w-96">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">JobHunter</h1>
        <p className="text-gray-600 mb-8">Automated job search & tracking</p>
        <button
          onClick={handleSignIn}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition"
        >
          Sign In with AWS Cognito
        </button>
      </div>
    </div>
  )
}
