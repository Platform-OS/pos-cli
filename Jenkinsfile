pipeline {
  agent any
  stages {
    stage('Build') {
      when {
        branch 'node-version'
      }
      steps {
        build job: 'build-marketplace-kit', parameters: [], quietPeriod: 0
      }
    }
  }
}
