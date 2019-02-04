pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'docker run --rm -v $PWD:/app node:alpine sh -c "cd /app && npm install && npm run test"'
      }
    }
    stage('Build') {
      when {
        branch 'master'
      }
      steps {
        build job: 'build-marketplace-kit', parameters: [], quietPeriod: 0
      }
    }
  }
}
