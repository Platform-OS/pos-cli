pipeline {
  agent any
  stages {
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
